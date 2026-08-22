/*****************************************************************************
 * autobrightness.c: automatic scene-adaptive brightness filter for VLC 3.x
 *****************************************************************************/
#ifdef HAVE_CONFIG_H
# include "config.h"
#endif

#include <math.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>

#include <vlc_common.h>
#include <vlc_plugin.h>
#include <vlc_filter.h>
#include <vlc_picture.h>

#include "autobrightness_algo.h"

#define FILTER_PREFIX "autobrightness-"

static int Create(vlc_object_t *);
static void Destroy(vlc_object_t *);
static picture_t *Filter(filter_t *, picture_t *);

#define DARK_TEXT N_("Dark-scene median threshold")
#define DARK_LONGTEXT N_("If the median luma is below this 8-bit-equivalent value, automatic brightening may be applied.")
#define TARGET_TEXT N_("Target median luma")
#define TARGET_LONGTEXT N_("Target median luma for dark scenes, expressed in 8-bit-equivalent luma units.")
#define BLACK_TEXT N_("Black-frame protection")
#define BLACK_LONGTEXT N_("Frames whose 90th percentile is below this value are treated as fades/black frames and are not lifted.")
#define HIGHLIGHT_TEXT N_("Highlight guard")
#define HIGHLIGHT_LONGTEXT N_("Above this 95th-percentile luma value the filter progressively reduces the correction to protect highlights.")
#define MAX_GAMMA_TEXT N_("Maximum gamma boost")
#define MAX_GAMMA_LONGTEXT N_("Upper limit for the adaptive shadow/midtone gamma correction.")
#define STRENGTH_TEXT N_("Correction strength")
#define STRENGTH_LONGTEXT N_("Multiplier for the adaptive correction. 1.0 is the recommended default.")
#define ATTACK_TEXT N_("Brightening attack time (ms)")
#define ATTACK_LONGTEXT N_("How quickly the filter increases correction when a scene becomes darker.")
#define RELEASE_TEXT N_("Brightening release time (ms)")
#define RELEASE_LONGTEXT N_("How quickly the filter removes correction when a scene becomes brighter.")
#define SAMPLES_TEXT N_("Target luma samples per frame")
#define SAMPLES_LONGTEXT N_("Approximate number of luma samples used to classify each frame. The full frame is transformed only when correction is active.")
#define DEBUG_TEXT N_("Log auto-brightness statistics")
#define DEBUG_LONGTEXT N_("Write periodic luma percentiles and gamma decisions to the VLC log.")

vlc_module_begin()
    set_description(N_("Automatic adaptive brightness filter"))
    set_shortname(N_("Auto Brightness"))
    set_category(CAT_VIDEO)
    set_subcategory(SUBCAT_VIDEO_VFILTER)
    set_capability("video filter", 0)

    add_float_with_range(FILTER_PREFIX "dark-threshold", 90.0, 20.0, 160.0,
                         DARK_TEXT, DARK_LONGTEXT, false)
        change_safe()
    add_float_with_range(FILTER_PREFIX "target-median", 104.0, 40.0, 180.0,
                         TARGET_TEXT, TARGET_LONGTEXT, false)
        change_safe()
    add_float_with_range(FILTER_PREFIX "black-frame-p90", 24.0, 0.0, 80.0,
                         BLACK_TEXT, BLACK_LONGTEXT, false)
        change_safe()
    add_float_with_range(FILTER_PREFIX "highlight-guard-p95", 210.0, 140.0, 250.0,
                         HIGHLIGHT_TEXT, HIGHLIGHT_LONGTEXT, false)
        change_safe()
    add_float_with_range(FILTER_PREFIX "max-gamma", 1.50, 1.0, 2.5,
                         MAX_GAMMA_TEXT, MAX_GAMMA_LONGTEXT, false)
        change_safe()
    add_float_with_range(FILTER_PREFIX "strength", 1.0, 0.0, 1.5,
                         STRENGTH_TEXT, STRENGTH_LONGTEXT, false)
        change_safe()
    add_float_with_range(FILTER_PREFIX "attack-ms", 220.0, 20.0, 2000.0,
                         ATTACK_TEXT, ATTACK_LONGTEXT, false)
        change_safe()
    add_float_with_range(FILTER_PREFIX "release-ms", 850.0, 50.0, 5000.0,
                         RELEASE_TEXT, RELEASE_LONGTEXT, false)
        change_safe()
    add_integer_with_range(FILTER_PREFIX "target-samples", 12000, 1000, 100000,
                           SAMPLES_TEXT, SAMPLES_LONGTEXT, false)
        change_safe()
    add_bool(FILTER_PREFIX "debug", false, DEBUG_TEXT, DEBUG_LONGTEXT, false)
        change_safe()

    add_shortcut("autobrightness")
    set_callbacks(Create, Destroy)
vlc_module_end()

static const char *const ppsz_filter_options[] = {
    "dark-threshold",
    "target-median",
    "black-frame-p90",
    "highlight-guard-p95",
    "max-gamma",
    "strength",
    "attack-ms",
    "release-ms",
    "target-samples",
    "debug",
    NULL
};

typedef struct
{
    ab_config_t cfg;
    ab_state_t state;
    mtime_t last_date;
    bool have_last_date;
    bool debug;
    unsigned debug_counter;
    unsigned bits;
    bool full_range;
    bool packed;
    unsigned packed_y_offset;
} filter_sys_t;

static bool IsFullRange(vlc_fourcc_t chroma)
{
    switch (chroma)
    {
        case VLC_CODEC_J420:
        case VLC_CODEC_J422:
        case VLC_CODEC_J444:
            return true;
        default:
            return false;
    }
}

static int DescribeChroma(vlc_fourcc_t chroma, unsigned *bits, bool *packed,
                          unsigned *packed_y_offset)
{
    *packed = false;
    *packed_y_offset = 0;

    switch (chroma)
    {
        case VLC_CODEC_I420:
        case VLC_CODEC_J420:
        case VLC_CODEC_YV12:
        case VLC_CODEC_I411:
        case VLC_CODEC_I410:
        case VLC_CODEC_I422:
        case VLC_CODEC_J422:
        case VLC_CODEC_I444:
        case VLC_CODEC_J444:
        case VLC_CODEC_YUVA:
        case VLC_CODEC_NV12:
        case VLC_CODEC_NV21:
        case VLC_CODEC_NV16:
        case VLC_CODEC_NV61:
        case VLC_CODEC_NV24:
        case VLC_CODEC_NV42:
        case VLC_CODEC_GREY:
            *bits = 8;
            return VLC_SUCCESS;

        case VLC_CODEC_I420_9L:
        case VLC_CODEC_I420_9B:
        case VLC_CODEC_I444_9L:
        case VLC_CODEC_I444_9B:
            *bits = 9;
            return VLC_SUCCESS;

        case VLC_CODEC_I420_10L:
        case VLC_CODEC_I420_10B:
        case VLC_CODEC_I444_10L:
        case VLC_CODEC_I444_10B:
            *bits = 10;
            return VLC_SUCCESS;

        case VLC_CODEC_UYVY:
        case VLC_CODEC_VYUY:
            *bits = 8;
            *packed = true;
            *packed_y_offset = 1;
            return VLC_SUCCESS;

        case VLC_CODEC_YUYV:
        case VLC_CODEC_YVYU:
            *bits = 8;
            *packed = true;
            *packed_y_offset = 0;
            return VLC_SUCCESS;

        default:
            return VLC_EGENERIC;
    }
}

static float GetFrameDeltaMs(filter_sys_t *sys, const picture_t *pic)
{
    float dt_ms = 33.333f;
    if (sys->have_last_date && pic->date > 0 && sys->last_date > 0 && pic->date > sys->last_date)
        dt_ms = (float)(pic->date - sys->last_date) / 1000.0f;

    if (pic->date > 0)
    {
        sys->last_date = pic->date;
        sys->have_last_date = true;
    }
    return dt_ms;
}

static void LoadConfig(filter_t *filter, filter_sys_t *sys)
{
    ab_default_config(&sys->cfg);

    config_ChainParse(filter, FILTER_PREFIX, ppsz_filter_options, filter->p_cfg);

    sys->cfg.dark_threshold_8bit = var_CreateGetFloatCommand(filter, FILTER_PREFIX "dark-threshold");
    sys->cfg.target_median_8bit = var_CreateGetFloatCommand(filter, FILTER_PREFIX "target-median");
    sys->cfg.black_frame_p90_8bit = var_CreateGetFloatCommand(filter, FILTER_PREFIX "black-frame-p90");
    sys->cfg.highlight_guard_p95_8bit = var_CreateGetFloatCommand(filter, FILTER_PREFIX "highlight-guard-p95");
    sys->cfg.max_gamma = var_CreateGetFloatCommand(filter, FILTER_PREFIX "max-gamma");
    sys->cfg.strength = var_CreateGetFloatCommand(filter, FILTER_PREFIX "strength");
    sys->cfg.attack_ms = var_CreateGetFloatCommand(filter, FILTER_PREFIX "attack-ms");
    sys->cfg.release_ms = var_CreateGetFloatCommand(filter, FILTER_PREFIX "release-ms");
    sys->cfg.target_samples = (unsigned)var_CreateGetIntegerCommand(filter, FILTER_PREFIX "target-samples");
    sys->debug = var_CreateGetBoolCommand(filter, FILTER_PREFIX "debug");
}

static int Create(vlc_object_t *obj)
{
    filter_t *filter = (filter_t *)obj;

    if (filter->fmt_in.video.i_chroma != filter->fmt_out.video.i_chroma)
    {
        msg_Err(filter, "input and output chromas do not match");
        return VLC_EGENERIC;
    }

    filter_sys_t *sys = calloc(1, sizeof(*sys));
    if (!sys)
        return VLC_ENOMEM;

    if (DescribeChroma(filter->fmt_in.video.i_chroma, &sys->bits,
                       &sys->packed, &sys->packed_y_offset) != VLC_SUCCESS)
    {
        msg_Dbg(filter, "unsupported input chroma (%4.4s)",
                (char *)&filter->fmt_in.video.i_chroma);
        free(sys);
        return VLC_EGENERIC;
    }

    sys->full_range = IsFullRange(filter->fmt_in.video.i_chroma);
    ab_reset(&sys->state);
    LoadConfig(filter, sys);

    filter->p_sys = sys;
    filter->pf_video_filter = Filter;

    msg_Dbg(filter, "auto brightness enabled: bits=%u full_range=%d packed=%d",
            sys->bits, (int)sys->full_range, (int)sys->packed);
    return VLC_SUCCESS;
}

static void Destroy(vlc_object_t *obj)
{
    filter_t *filter = (filter_t *)obj;
    free(filter->p_sys);
}

static ab_result_t AnalyzeFrame(filter_sys_t *sys, const picture_t *pic, float dt_ms)
{
    const plane_t *y = &pic->p[0];
    const unsigned height = (unsigned)y->i_visible_lines;

    if (sys->packed)
    {
        const unsigned width = (unsigned)y->i_visible_pitch / 2u;
        return ab_analyze_u8(y->p_pixels, y->i_pitch, width, height,
                             2, sys->packed_y_offset, sys->full_range,
                             dt_ms, &sys->cfg, &sys->state);
    }

    if (sys->bits == 8)
    {
        const unsigned width = (unsigned)y->i_visible_pitch;
        return ab_analyze_u8(y->p_pixels, y->i_pitch, width, height,
                             1, 0, sys->full_range,
                             dt_ms, &sys->cfg, &sys->state);
    }

    const unsigned width = (unsigned)y->i_visible_pitch / 2u;
    return ab_analyze_u16((const uint16_t *)y->p_pixels, y->i_pitch,
                          width, height, sys->bits, sys->full_range,
                          dt_ms, &sys->cfg, &sys->state);
}

static void ApplyLut8Planar(picture_t *dst, const picture_t *src, const uint8_t lut[256])
{
    const plane_t *in = &src->p[0];
    plane_t *out = &dst->p[0];

    for (int y = 0; y < in->i_visible_lines; ++y)
    {
        const uint8_t *s = in->p_pixels + (ptrdiff_t)y * in->i_pitch;
        uint8_t *d = out->p_pixels + (ptrdiff_t)y * out->i_pitch;
        for (int x = 0; x < in->i_visible_pitch; ++x)
            d[x] = lut[s[x]];
    }
}

static void ApplyLut8Packed(picture_t *dst, const picture_t *src,
                            const uint8_t lut[256], unsigned y_offset)
{
    const plane_t *in = &src->p[0];
    plane_t *out = &dst->p[0];

    for (int y = 0; y < in->i_visible_lines; ++y)
    {
        const uint8_t *s = in->p_pixels + (ptrdiff_t)y * in->i_pitch;
        uint8_t *d = out->p_pixels + (ptrdiff_t)y * out->i_pitch;
        for (int x = (int)y_offset; x < in->i_visible_pitch; x += 2)
            d[x] = lut[s[x]];
    }
}

static void ApplyLut16Planar(picture_t *dst, const picture_t *src,
                             const uint16_t *lut, unsigned bits)
{
    const plane_t *in = &src->p[0];
    plane_t *out = &dst->p[0];
    const unsigned mask = (1u << bits) - 1u;
    const int width = in->i_visible_pitch / 2;

    for (int y = 0; y < in->i_visible_lines; ++y)
    {
        const uint16_t *s = (const uint16_t *)(in->p_pixels + (ptrdiff_t)y * in->i_pitch);
        uint16_t *d = (uint16_t *)(out->p_pixels + (ptrdiff_t)y * out->i_pitch);
        for (int x = 0; x < width; ++x)
            d[x] = lut[s[x] & mask];
    }
}

static picture_t *Filter(filter_t *filter, picture_t *pic)
{
    if (!pic)
        return NULL;

    filter_sys_t *sys = filter->p_sys;
    const float dt_ms = GetFrameDeltaMs(sys, pic);
    const ab_result_t result = AnalyzeFrame(sys, pic, dt_ms);

    if (sys->debug && (++sys->debug_counter % 60u) == 0u)
    {
        msg_Dbg(filter,
                "p10=%u p50=%u p90=%u p95=%u desired_gamma=%.3f applied_gamma=%.3f step=%u samples=%u",
                result.p10, result.p50, result.p90, result.p95,
                result.desired_gamma, result.applied_gamma,
                result.sample_step, result.sample_count);
    }

    /* Fast path: classification still happens, but bright scenes are returned unchanged. */
    if (!result.active)
        return pic;

    picture_t *out = filter_NewPicture(filter);
    if (!out)
    {
        picture_Release(pic);
        return NULL;
    }

    picture_CopyPixels(out, pic);

    if (sys->bits == 8)
    {
        uint8_t lut[256];
        ab_build_lut_u8(lut, sys->full_range, result.applied_gamma);
        if (sys->packed)
            ApplyLut8Packed(out, pic, lut, sys->packed_y_offset);
        else
            ApplyLut8Planar(out, pic, lut);
    }
    else
    {
        uint16_t lut[1024];
        ab_build_lut_u16(lut, sys->bits, sys->full_range, result.applied_gamma);
        ApplyLut16Planar(out, pic, lut, sys->bits);
    }

    picture_CopyProperties(out, pic);
    picture_Release(pic);
    return out;
}
