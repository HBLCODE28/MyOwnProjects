#include <assert.h>
#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "../src/autobrightness_algo.h"

static void fill(uint8_t *p, unsigned w, unsigned h, uint8_t v)
{
    memset(p, v, (size_t)w * h);
}

int main(void)
{
    const unsigned w = 320, h = 180;
    uint8_t *frame = malloc((size_t)w * h);
    assert(frame);

    ab_config_t cfg;
    ab_state_t state;
    ab_default_config(&cfg);
    cfg.target_samples = 4000;

    ab_reset(&state);
    fill(frame, w, h, 140);
    ab_result_t bright = ab_analyze_u8(frame, w, w, h, 1, 0, false, 33.3f, &cfg, &state);
    assert(bright.desired_gamma == 1.0f);
    assert(!bright.active);

    ab_reset(&state);
    fill(frame, w, h, 50);
    ab_result_t dark = {0};
    for (int i = 0; i < 20; ++i)
        dark = ab_analyze_u8(frame, w, w, h, 1, 0, false, 33.3f, &cfg, &state);
    assert(dark.desired_gamma > 1.1f);
    assert(dark.applied_gamma > 1.05f);
    assert(dark.active);

    ab_reset(&state);
    fill(frame, w, h, 10);
    ab_result_t black = ab_analyze_u8(frame, w, w, h, 1, 0, false, 33.3f, &cfg, &state);
    assert(black.desired_gamma == 1.0f);
    assert(!black.active);

    ab_reset(&state);
    fill(frame, w, h, 50);
    ab_result_t no_highlights = ab_analyze_u8(frame, w, w, h, 1, 0, false, 1000.0f, &cfg, &state);

    ab_reset(&state);
    fill(frame, w, h, 50);
    for (unsigned y = 0; y < h; ++y)
        for (unsigned x = 0; x < w / 8; ++x)
            frame[(size_t)y * w + x] = 245;
    ab_result_t with_highlights = ab_analyze_u8(frame, w, w, h, 1, 0, false, 1000.0f, &cfg, &state);
    assert(with_highlights.p95 >= 240);
    assert(with_highlights.desired_gamma < no_highlights.desired_gamma);

    uint8_t lut[256];
    ab_build_lut_u8(lut, false, 1.4f);
    assert(lut[16] == 16);
    assert(lut[235] == 235);
    assert(lut[80] > 80);
    for (unsigned i = 1; i < 256; ++i)
        assert(lut[i] >= lut[i - 1] || (i == 16 && lut[i] >= lut[i - 1]));

    free(frame);
    puts("autobrightness algorithm tests: PASS");
    return 0;
}
