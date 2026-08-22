#!/usr/bin/env python3
import argparse
import shutil
from pathlib import Path


def main():
    p = argparse.ArgumentParser(description="Integrate Auto Brightness into a VLC 3.x source tree")
    p.add_argument("vlc_source", help="Path to VLC 3.x source tree")
    args = p.parse_args()

    root = Path(args.vlc_source).resolve()
    vf = root / "modules" / "video_filter"
    mf = vf / "Makefile.am"
    if not mf.exists():
        raise SystemExit(f"Not a VLC 3.x source tree: {mf} was not found")

    here = Path(__file__).resolve().parents[1]
    for name in ["autobrightness.c", "autobrightness_algo.c", "autobrightness_algo.h"]:
        shutil.copy2(here / "src" / name, vf / name)
        print(f"copied {name}")

    text = mf.read_text(encoding="utf-8")

    source_block = (
        "libautobrightness_plugin_la_SOURCES = video_filter/autobrightness.c "
        "video_filter/autobrightness_algo.c video_filter/autobrightness_algo.h\n"
        "libautobrightness_plugin_la_LIBADD = $(LIBM)\n\n"
    )
    if "libautobrightness_plugin_la_SOURCES" not in text:
        marker = "libadjust_plugin_la_SOURCES ="
        idx = text.find(marker)
        if idx < 0:
            raise SystemExit("Could not find libadjust_plugin_la_SOURCES in modules/video_filter/Makefile.am")
        text = text[:idx] + source_block + text[idx:]
        print("added autobrightness source target")

    if "libautobrightness_plugin.la \\" not in text:
        marker = "video_filter_LTLIBRARIES = \\\n"
        idx = text.find(marker)
        if idx < 0:
            raise SystemExit("Could not find video_filter_LTLIBRARIES in modules/video_filter/Makefile.am")
        insert_at = idx + len(marker)
        text = text[:insert_at] + "\tlibautobrightness_plugin.la \\\n" + text[insert_at:]
        print("added autobrightness to video_filter_LTLIBRARIES")

    mf.write_text(text, encoding="utf-8")
    print("integration complete")
    print("next: run ./bootstrap, configure/build VLC, then build libautobrightness_plugin.la")


if __name__ == "__main__":
    main()
