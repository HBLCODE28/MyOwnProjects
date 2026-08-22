#include "autobrightness_algo.h"

#include <math.h>
#include <string.h>

#define AB_HIST_MAX 1024u

static float clampf_local(float v, float lo, float hi)
{
    if (v < lo) return lo;
    if (v > hi) return hi;
    return v;
}

static unsigned clampu_local(unsigned v, unsigned lo, unsigned hi)
{
    if (v < lo) return lo;
    if (v > hi) return hi;
    return v;
}

static unsigned compute_sample_step(unsigned width, unsigned height, unsigned target_samples)
{
    if (target_samples == 0)
        target_samples = 12000;

    const double total = (double)width * (double)height;
    if (total <= (double)target_samples)
        return 1;

    unsigned step = (unsigned)ceil(sqrt(total / (double)target_samples));
    return clampu_local(step, 1, 64);
}

static unsigned percentile_from_hist(const uint32_t *hist, unsigned bins,
                                     uint32_t count, unsigned numerator,
                                     unsigned denominator)
{
    if (count == 0 || bins == 0)
        return 0;

    const uint32_t target = (uint32_t)(((uint64_t)count * numerator + denominator - 1) / denominator);
    uint32_t acc = 0;
    for (unsigned i = 0; i < bins; ++i)
    {
        acc += hist[i];
        if (acc >= target)
            return i;
    }
    return bins - 1;
}

static float code_to_8bit(unsigned code, unsigned bits)
{
    if (bits <= 8)
        return (float)code;
    return (float)code / (float)(1u << (bits - 8));
}

static void range_for_bits(unsigned bits, bool full_range, float *black, float *white)
{
    const float scale = (float)(1u << (bits - 8));
    if (full_range)
    {
        *black = 0.0f;
        *white = (float)((1u << bits) - 1u);
    }
    else
    {
        *black = 16.0f * scale;
        *white = 235.0f * scale;
    }
}

static float compute_desired_gamma(unsigned p50, unsigned p90, unsigned p95,
                                   unsigned bits, bool full_range,
                                   const ab_config_t *cfg)
{
    float black, white;
    range_for_bits(bits, full_range, &black, &white);

    const float scale = (float)(1u << (bits - 8));
    const float dark_threshold = cfg->dark_threshold_8bit * scale;
    const float target_median = cfg->target_median_8bit * scale;
    const float black_frame_p90 = cfg->black_frame_p90_8bit * scale;
    const float highlight_guard = cfg->highlight_guard_p95_8bit * scale;

    if ((float)p90 <= black_frame_p90)
        return 1.0f;
    if ((float)p50 >= dark_threshold)
        return 1.0f;

    const float denom = white - black;
    if (denom <= 1.0f)
        return 1.0f;

    float median_n = ((float)p50 - black) / denom;
    float target_n = (target_median - black) / denom;
    median_n = clampf_local(median_n, 0.01f, 0.98f);
    target_n = clampf_local(target_n, median_n + 0.01f, 0.90f);

    float gamma = logf(median_n) / logf(target_n);
    gamma = clampf_local(gamma, 1.0f, cfg->max_gamma);

    const float dark_span = fmaxf(1.0f, dark_threshold - black);
    const float darkness = clampf_local((dark_threshold - (float)p50) / dark_span, 0.0f, 1.0f);

    float highlight_factor = 1.0f;
    const float hard_highlight = white - 2.0f * scale;
    if ((float)p95 > highlight_guard)
    {
        const float span = fmaxf(1.0f, hard_highlight - highlight_guard);
        const float t = clampf_local(((float)p95 - highlight_guard) / span, 0.0f, 1.0f);
        highlight_factor = 1.0f - 0.65f * t;
    }

    const float amount = clampf_local(cfg->strength, 0.0f, 1.5f)
                       * (0.35f + 0.65f * darkness)
                       * highlight_factor;

    gamma = 1.0f + (gamma - 1.0f) * amount;
    return clampf_local(gamma, 1.0f, cfg->max_gamma);
}

static float smooth_gamma(float desired, float dt_ms,
                          float median_8bit,
                          const ab_config_t *cfg,
                          ab_state_t *state)
{
    if (dt_ms <= 0.0f || dt_ms > 1000.0f)
        dt_ms = 33.333f;

    float tau = desired > state->current_gamma ? cfg->attack_ms : cfg->release_ms;
    if (tau < 1.0f)
        tau = 1.0f;

    if (state->has_last_median && fabsf(median_8bit - state->last_median_8bit) >= 35.0f)
        tau = fminf(tau, 80.0f);

    const float alpha = 1.0f - expf(-dt_ms / tau);
    state->current_gamma += alpha * (desired - state->current_gamma);

    if (fabsf(state->current_gamma - 1.0f) < 0.0025f && desired <= 1.001f)
        state->current_gamma = 1.0f;

    state->last_median_8bit = median_8bit;
    state->has_last_median = true;
    return state->current_gamma;
}

void ab_default_config(ab_config_t *cfg)
{
    cfg->dark_threshold_8bit = 90.0f;
    cfg->target_median_8bit = 104.0f;
    cfg->black_frame_p90_8bit = 24.0f;
    cfg->highlight_guard_p95_8bit = 210.0f;
    cfg->max_gamma = 1.50f;
    cfg->strength = 1.0f;
    cfg->attack_ms = 220.0f;
    cfg->release_ms = 850.0f;
    cfg->target_samples = 12000;
}

void ab_reset(ab_state_t *state)
{
    state->current_gamma = 1.0f;
    state->last_median_8bit = 0.0f;
    state->has_last_median = false;
}

ab_result_t ab_analyze_u8(const uint8_t *pixels,
                          ptrdiff_t pitch,
                          unsigned width,
                          unsigned height,
                          unsigned pixel_stride,
                          unsigned pixel_offset,
                          bool full_range,
                          float dt_ms,
                          const ab_config_t *cfg,
                          ab_state_t *state)
{
    ab_result_t r;
    memset(&r, 0, sizeof(r));
    r.desired_gamma = 1.0f;
    r.applied_gamma = state->current_gamma;

    if (!pixels || width == 0 || height == 0 || pixel_stride == 0)
        return r;

    uint32_t hist[256];
    memset(hist, 0, sizeof(hist));

    const unsigned step = compute_sample_step(width, height, cfg->target_samples);
    uint32_t count = 0;

    for (unsigned y = step / 2; y < height; y += step)
    {
        const uint8_t *row = pixels + (ptrdiff_t)y * pitch;
        for (unsigned x = step / 2; x < width; x += step)
        {
            const uint8_t v = row[(size_t)x * pixel_stride + pixel_offset];
            ++hist[v];
            ++count;
        }
    }

    if (count == 0)
        return r;

    r.sample_step = step;
    r.sample_count = count;
    r.p10 = percentile_from_hist(hist, 256, count, 10, 100);
    r.p50 = percentile_from_hist(hist, 256, count, 50, 100);
    r.p90 = percentile_from_hist(hist, 256, count, 90, 100);
    r.p95 = percentile_from_hist(hist, 256, count, 95, 100);
    r.desired_gamma = compute_desired_gamma(r.p50, r.p90, r.p95, 8, full_range, cfg);
    r.applied_gamma = smooth_gamma(r.desired_gamma, dt_ms, (float)r.p50, cfg, state);
    r.active = r.applied_gamma > 1.005f;
    return r;
}

ab_result_t ab_analyze_u16(const uint16_t *pixels,
                           ptrdiff_t pitch_bytes,
                           unsigned width,
                           unsigned height,
                           unsigned bits,
                           bool full_range,
                           float dt_ms,
                           const ab_config_t *cfg,
                           ab_state_t *state)
{
    ab_result_t r;
    memset(&r, 0, sizeof(r));
    r.desired_gamma = 1.0f;
    r.applied_gamma = state->current_gamma;

    if (!pixels || width == 0 || height == 0 || bits < 9 || bits > 10)
        return r;

    const unsigned bins = 1u << bits;
    uint32_t hist[AB_HIST_MAX];
    memset(hist, 0, bins * sizeof(hist[0]));

    const unsigned step = compute_sample_step(width, height, cfg->target_samples);
    uint32_t count = 0;

    for (unsigned y = step / 2; y < height; y += step)
    {
        const uint16_t *row = (const uint16_t *)((const uint8_t *)pixels + (ptrdiff_t)y * pitch_bytes);
        for (unsigned x = step / 2; x < width; x += step)
        {
            const unsigned v = row[x] & (bins - 1u);
            ++hist[v];
            ++count;
        }
    }

    if (count == 0)
        return r;

    r.sample_step = step;
    r.sample_count = count;
    r.p10 = percentile_from_hist(hist, bins, count, 10, 100);
    r.p50 = percentile_from_hist(hist, bins, count, 50, 100);
    r.p90 = percentile_from_hist(hist, bins, count, 90, 100);
    r.p95 = percentile_from_hist(hist, bins, count, 95, 100);
    r.desired_gamma = compute_desired_gamma(r.p50, r.p90, r.p95, bits, full_range, cfg);
    r.applied_gamma = smooth_gamma(r.desired_gamma, dt_ms, code_to_8bit(r.p50, bits), cfg, state);
    r.active = r.applied_gamma > 1.005f;
    return r;
}

void ab_build_lut_u8(uint8_t lut[256], bool full_range, float gamma)
{
    float black, white;
    range_for_bits(8, full_range, &black, &white);
    const float inv_gamma = 1.0f / fmaxf(1.0f, gamma);

    for (unsigned i = 0; i < 256; ++i)
    {
        if ((float)i <= black || (float)i >= white)
        {
            lut[i] = (uint8_t)i;
            continue;
        }

        const float x = ((float)i - black) / (white - black);
        const float y = powf(x, inv_gamma);
        const long mapped = lroundf(black + y * (white - black));
        lut[i] = (uint8_t)clampu_local((unsigned)(mapped < 0 ? 0 : mapped), 0, 255);
    }
}

void ab_build_lut_u16(uint16_t *lut, unsigned bits, bool full_range, float gamma)
{
    if (!lut || bits < 9 || bits > 10)
        return;

    const unsigned bins = 1u << bits;
    const unsigned maxv = bins - 1u;
    float black, white;
    range_for_bits(bits, full_range, &black, &white);
    const float inv_gamma = 1.0f / fmaxf(1.0f, gamma);

    for (unsigned i = 0; i < bins; ++i)
    {
        if ((float)i <= black || (float)i >= white)
        {
            lut[i] = (uint16_t)i;
            continue;
        }

        const float x = ((float)i - black) / (white - black);
        const float y = powf(x, inv_gamma);
        const long mapped = lroundf(black + y * (white - black));
        lut[i] = (uint16_t)clampu_local((unsigned)(mapped < 0 ? 0 : mapped), 0, maxv);
    }
}
