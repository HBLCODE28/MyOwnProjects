import argparse
import json
import os
import re
import shutil
import sys
import traceback
from pathlib import Path


SKIP_MARKERS = (
    "with gr.Blocks(",
    "# GRADIO INTERFACE",
    "WEBSITE AUTORUN HOOK",
    "drive.mount(",
    "pip', 'install', 'yt-dlp'",
    'pip", "install", "yt-dlp"',
)

TRAINING_OVERRIDES = {
    # All original files are loaded, but only a subset receives expensive augmentation.
    "AUGMENTATION_FILE_LIMIT": 96,
    "COMPOSITE_AUGMENTATION_LIMIT": 96,
    "L2_REGULARIZATION": 0.0032,
    "LABEL_SMOOTHING": 0.05,
    "EARLY_STOPPING_PATIENCE": 6,
    "LR_REDUCTION_PATIENCE": 4,
}
# Two representative windows align training and evaluation with real-song
# multi-segment prediction while keeping every genre equally represented.
RUNNER_SEGMENT_COUNT_TRAIN = 2
RUNNER_SEGMENT_COUNT_EVAL = 2
RUNNER_COMPOSITE_VARIANTS = 1
ENERGY_SCORE_WEIGHT = 0.6
SPECTRAL_SCORE_WEIGHT = 0.4
GRADIO_IMPORT_PATTERN = re.compile(r"^\s*import gradio as gr\s*$", re.MULTILINE)


class ConsoleProgress:
    def __call__(self, value, desc=""):
        """Print one training progress update.
        Input: progress value and optional description.
        Output: None.
        """
        if isinstance(value, (int, float)):
            percent = value * 100 if value <= 1 else value
        else:
            percent = 0
        print(f"[progress] {max(0, min(100, int(percent)))}% {desc}", flush=True)


class TrainingGradioStub:
    class Progress:
        def __call__(self, *args, **kwargs):
            return None

    @staticmethod
    def update(**kwargs):
        return kwargs


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--summary-path", default="")
    return parser.parse_args()


def should_skip_cell(source):
    return any(marker in source for marker in SKIP_MARKERS)


def prepare_cell_source(source):
    if "import gradio as gr" not in source:
        return source
    return GRADIO_IMPORT_PATTERN.sub("", source)


def load_training_namespace(notebook_path):
    notebook = json.loads(notebook_path.read_text(encoding="utf-8"))
    namespace = {"__name__": "__main__", "gr": TrainingGradioStub()}
    executed_cells = 0

    for cell_index, cell in enumerate(notebook.get("cells", [])):
        if cell.get("cell_type") != "code":
            continue
        source = "".join(cell.get("source", []))
        if not source.strip() or should_skip_cell(source):
            continue
        source = prepare_cell_source(source)
        code = compile(source, f"{notebook_path.name}:cell_{cell_index}", "exec")
        exec(code, namespace)
        executed_cells += 1

    print(f"Loaded training namespace from {executed_cells} notebook cells.", flush=True)
    return namespace


def apply_training_overrides(namespace):
    """Apply runner-specific limits to the notebook configuration.
    Input: notebook execution namespace.
    Output: None; the namespace is updated in place.
    """
    for key, value in TRAINING_OVERRIDES.items():
        if key in namespace:
            namespace[key] = value
            print(f"Override applied: {key}={value}", flush=True)


def install_runner_training_patches(namespace):
    """Install memory-aware audio loaders for standalone training.
    Input: notebook execution namespace.
    Output: None; selected notebook functions are replaced in place.
    """
    librosa = namespace["librosa"]
    np = namespace["np"]

    sample_rate = namespace["SAMPLE_RATE"]
    target_samples = namespace["TARGET_SAMPLES"]
    duration_seconds = namespace["DURATION_SECONDS"]
    time_stretch_enabled = namespace["ENABLE_TIME_STRETCH_AUGMENTATION"]
    time_stretch_min = namespace["TIME_STRETCH_MIN"]
    time_stretch_max = namespace["TIME_STRETCH_MAX"]
    noise_factor = namespace["NOISE_FACTOR"]
    build_composite_genre_spec = namespace["build_composite_genre_spec"]
    audio_to_mfcc = namespace["audio_to_mfcc"]
    apply_mfcc_mask = namespace["apply_mfcc_mask"]

    def select_representative_windows(full_audio, segment_count=1):
        if len(full_audio) <= target_samples:
            return [full_audio]

        step_size = max(1, target_samples // 3)
        min_gap = max(1, target_samples // 2)
        candidates = []

        for start_idx in range(0, len(full_audio) - target_samples + 1, step_size):
            window = full_audio[start_idx:start_idx + target_samples]
            energy = float(np.mean(np.square(window)))
            spectral_centroid = float(np.mean(librosa.feature.spectral_centroid(y=window, sr=sample_rate)))
            candidates.append((energy, spectral_centroid, start_idx))

        candidates.sort(reverse=True)
        chosen_candidates = []

        if candidates:
            chosen_candidates.append(candidates[0])

        while len(chosen_candidates) < segment_count:
            available = [
                candidate
                for candidate in candidates
                if all(abs(candidate[2] - chosen[2]) >= min_gap for chosen in chosen_candidates)
            ]
            if not available:
                break

            max_energy = max(candidate[0] for candidate in candidates) or 1.0
            centroid_values = [candidate[1] for candidate in candidates]
            centroid_range = max(centroid_values) - min(centroid_values) or 1.0

            def diversity_score(candidate):
                energy_score = candidate[0] / max_energy
                centroid_distance = min(
                    abs(candidate[1] - chosen[1])
                    for chosen in chosen_candidates
                ) / centroid_range
                return (
                    ENERGY_SCORE_WEIGHT * energy_score
                    + SPECTRAL_SCORE_WEIGHT * centroid_distance
                )

            next_candidate = max(available, key=diversity_score)
            chosen_candidates.append(next_candidate)

        chosen_starts = [candidate[2] for candidate in chosen_candidates]

        return [full_audio[start:start + target_samples] for start in chosen_starts]

    def load_audio_segments(file_path, segment_count=1):
        try:
            y_full, sr = librosa.load(file_path, sr=sample_rate, duration=30)
        except Exception:
            y_full, sr = librosa.load(file_path, sr=sample_rate, duration=duration_seconds)

        if len(y_full) == 0:
            segments = [np.zeros(target_samples, dtype=np.float32)]
        else:
            segments = select_representative_windows(y_full, segment_count=segment_count)

        normalized_segments = []
        for segment in segments:
            if len(segment) < target_samples:
                segment = np.pad(segment, (0, target_samples - len(segment)), "constant")
            else:
                segment = segment[:target_samples]
            normalized_segments.append(segment.astype(np.float32))

        return normalized_segments, sr

    def load_audio_segment(file_path):
        segments, sr = load_audio_segments(file_path, segment_count=1)
        return segments[0], sr

    def load_and_augment(file_path, scaler=None, fit_scaler=False, augment=False, peer_paths=None, add_composite=False):
        try:
            segment_count = RUNNER_SEGMENT_COUNT_TRAIN if augment else RUNNER_SEGMENT_COUNT_EVAL
            segments, sr = load_audio_segments(file_path, segment_count=segment_count)
            specs = []

            for segment in segments:
                spec, scaler = audio_to_mfcc(segment, sr, scaler, fit_scaler)
                if spec is not None:
                    specs.append(spec)

            primary_segment = segments[0] if segments else None

            if augment and primary_segment is not None:
                y_noise = primary_segment + noise_factor * np.random.randn(len(primary_segment))
                spec_noise, _ = audio_to_mfcc(y_noise, sr, scaler, False)
                if spec_noise is not None:
                    specs.append(spec_noise)

                if time_stretch_enabled:
                    try:
                        rate = np.random.uniform(time_stretch_min, time_stretch_max)
                        y_stretch = librosa.effects.time_stretch(primary_segment, rate=rate)
                        if len(y_stretch) > target_samples:
                            y_stretch = y_stretch[:target_samples]
                        else:
                            y_stretch = np.pad(y_stretch, (0, target_samples - len(y_stretch)), "constant")
                        spec_stretch, _ = audio_to_mfcc(y_stretch, sr, scaler, False)
                        if spec_stretch is not None:
                            specs.append(spec_stretch)
                    except Exception:
                        pass

                base_spec, _ = audio_to_mfcc(primary_segment, sr, scaler, False)
                masked_spec = apply_mfcc_mask(base_spec)
                if masked_spec is not None:
                    specs.append(masked_spec)

            if add_composite:
                for _ in range(RUNNER_COMPOSITE_VARIANTS):
                    composite_spec = build_composite_genre_spec(file_path, peer_paths or [], scaler)
                    if composite_spec is not None:
                        specs.append(composite_spec)

            return specs, scaler
        except Exception as exc:
            print(f"Error processing {file_path}: {exc}", flush=True)
            return [], scaler

    namespace["load_audio_segments"] = load_audio_segments
    namespace["load_audio_segment"] = load_audio_segment
    namespace["load_and_augment"] = load_and_augment
    namespace["PROGRESS_LOG_EVERY"] = max(12, int(namespace.get("PROGRESS_LOG_EVERY", 8)))
    print(
        f"Runner patch applied: train_segments={RUNNER_SEGMENT_COUNT_TRAIN}, "
        f"eval_segments={RUNNER_SEGMENT_COUNT_EVAL}, "
        f"composite_variants={RUNNER_COMPOSITE_VARIANTS}, "
        "sampling=balanced_energy_spectral",
        flush=True,
    )


def build_summary(status_message, summary_path):
    return {
        "status_message": status_message,
        "summary_path": str(summary_path) if summary_path else "",
    }


def save_summary(summary_path, payload):
    if not summary_path:
        return
    summary_path.parent.mkdir(parents=True, exist_ok=True)
    summary_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def preserve_active_model_scaler(project_dir):
    active_config = project_dir / "active_model.json"
    shared_scaler = project_dir / "mfcc_scaler.pkl"
    if not active_config.exists() or not shared_scaler.exists():
        return

    try:
        active_data = json.loads(active_config.read_text(encoding="utf-8"))
        active_reference = active_data.get("path") or active_data.get("model_path")
        if not active_reference:
            return
        active_model = project_dir / active_reference
        scaler_sidecar = active_model.with_suffix(".scaler.pkl")
        if active_model.exists() and not scaler_sidecar.exists():
            shutil.copy2(shared_scaler, scaler_sidecar)
            print(f"Preserved active model scaler at: {scaler_sidecar}", flush=True)
    except Exception as exc:
        print(f"Could not preserve active model scaler: {exc}", flush=True)


def main():
    args = parse_args()
    summary_path = Path(args.summary_path).resolve() if args.summary_path else None
    project_dir = Path(__file__).resolve().parent
    notebook_path = project_dir / "main.ipynb"

    os.chdir(project_dir)
    os.environ["BEATSENSE_BASE_PATH"] = str(project_dir)
    os.environ["BEATSENSE_AUTORUN_MAIN_TRAINING"] = "0"
    os.environ["BEATSENSE_MAIN_RUN_CONTEXT"] = "train_only_runner"

    try:
        preserve_active_model_scaler(project_dir)
        namespace = load_training_namespace(notebook_path)
        apply_training_overrides(namespace)
        install_runner_training_patches(namespace)

        train_logic = namespace.get("train_logic")
        if train_logic is None:
            raise RuntimeError("train_logic was not loaded from main.ipynb")

        status_message, _ = train_logic(progress=ConsoleProgress())
        print(status_message, flush=True)
        payload = build_summary(status_message, summary_path)
        save_summary(summary_path, payload)

        lowered = str(status_message).lower()
        if lowered.startswith("error") or "failed" in lowered:
            return 1
        return 0
    except Exception:
        traceback.print_exc()
        payload = build_summary("Main training runner crashed.", summary_path)
        payload["traceback"] = traceback.format_exc()
        save_summary(summary_path, payload)
        return 1


if __name__ == "__main__":
    sys.exit(main())
