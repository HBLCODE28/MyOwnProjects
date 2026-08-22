#ifndef VLC_AUTOBRIGHTNESS_ALGO_H
#define VLC_AUTOBRIGHTNESS_ALGO_H

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

typedef struct
{
    float dark_threshold_8bit;
    float target_median_8bit;
    float black_frame_p90_8bit;
    float highlight_guard_p95_8bit;
    float max_gamma;
    float strength;
    float attack_ms;
    float release_ms;
    unsigned target_samples;
} ab_config_t;

typedef struct
{
    float current_gamma;
    float last_median_8bit;
    bool has_last_median;
} ab_state_t;

typedef struct
{
    unsigned p10;
    unsigned p50;
    unsigned p90;
    unsigned p95;
    float desired_gamma;
    float applied_gamma;
    unsigned sample_step;
    unsigned sample_count;
    bool active;
} ab_result_t;

void ab_default_config(ab_config_t *cfg);
void ab_reset(ab_state_t *state);

ab_result_t ab_analyze_u8(const uint8_t *pixels,
                          ptrdiff_t pitch,
                          unsigned width,
                          unsigned height,
                          unsigned pixel_stride,
                          unsigned pixel_offset,
                          bool full_range,
                          float dt_ms,
                          const ab_config_t *cfg,
                          ab_state_t *state);

ab_result_t ab_analyze_u16(const uint16_t *pixels,
                           ptrdiff_t pitch_bytes,
                           unsigned width,
                           unsigned height,
                           unsigned bits,
                           bool full_range,
                           float dt_ms,
                           const ab_config_t *cfg,
                           ab_state_t *state);

void ab_build_lut_u8(uint8_t lut[256], bool full_range, float gamma);
void ab_build_lut_u16(uint16_t *lut, unsigned bits, bool full_range, float gamma);

#endif
