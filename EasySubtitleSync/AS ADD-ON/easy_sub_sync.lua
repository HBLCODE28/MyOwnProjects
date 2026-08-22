-- Easy Subtitle Sync for VLC
-- Simple subtitle synchronization for non-technical users.
-- Designed to work with VLC 3.x and newer Lua APIs where available.

local dlg = nil
local status_label = nil
local delay_label = nil

local audio_mark = nil
local subtitle_mark = nil

local NUDGE_SECONDS = 0.25

function descriptor()
    return {
        title = "Easy Subtitle Sync",
        version = "0.1.0",
        author = "OpenAI",
        shortdesc = "Simple subtitle synchronization",
        description = "Synchronize subtitles without calculating seconds.",
        capabilities = {"input-listener"}
    }
end

local function set_status(text)
    if status_label then
        status_label:set_text(text)
    end
    if dlg then
        dlg:update()
    end
end

local function format_delay(seconds)
    if math.abs(seconds) < 0.0005 then
        return "Current correction: none"
    end

    if seconds > 0 then
        return string.format("Current correction: subtitles delayed by %.2f s", seconds)
    else
        return string.format("Current correction: subtitles advanced by %.2f s", math.abs(seconds))
    end
end

local function get_media_time_seconds()
    -- VLC 4/newer Lua player API.
    if vlc.player and vlc.player.get_time then
        local ok, value = pcall(vlc.player.get_time)
        if ok and value then
            return value / 1000000.0
        end
    end

    -- VLC 3.x compatibility path.
    if vlc.object and vlc.object.input and vlc.var and vlc.var.get then
        local input = vlc.object.input()
        if input then
            local ok, value = pcall(vlc.var.get, input, "time")
            if ok and value then
                return value / 1000000.0
            end
        end
    end

    return nil
end

local function get_subtitle_delay_seconds()
    -- VLC 4/newer Lua player API.
    if vlc.player and vlc.player.get_subtitle_delay then
        local ok, value = pcall(vlc.player.get_subtitle_delay)
        if ok and value ~= nil then
            return value
        end
    end

    -- VLC 3.x compatibility path.
    if vlc.object and vlc.object.input and vlc.var and vlc.var.get then
        local input = vlc.object.input()
        if input then
            local ok, value = pcall(vlc.var.get, input, "spu-delay")
            if ok and value ~= nil then
                return value / 1000000.0
            end
        end
    end

    return 0
end

local function set_subtitle_delay_seconds(seconds)
    -- VLC 4/newer Lua player API.
    if vlc.player and vlc.player.set_subtitle_delay then
        local ok = pcall(vlc.player.set_subtitle_delay, seconds)
        if ok then
            return true
        end
    end

    -- VLC 3.x compatibility path.
    if vlc.object and vlc.object.input and vlc.var and vlc.var.set then
        local input = vlc.object.input()
        if input then
            local microseconds = math.floor(seconds * 1000000.0)
            local ok = pcall(vlc.var.set, input, "spu-delay", microseconds)
            if ok then
                return true
            end
        end
    end

    return false
end

local function refresh_delay_label()
    if delay_label then
        delay_label:set_text(format_delay(get_subtitle_delay_seconds()))
    end
end

local function clear_marks(message)
    audio_mark = nil
    subtitle_mark = nil

    if message then
        set_status(message)
    else
        set_status("Ready. Mark the spoken line and the matching subtitle.")
    end
end

local function try_apply_marks()
    if not audio_mark or not subtitle_mark then
        return
    end

    -- If the spoken line occurs at A and the subtitle appears at S,
    -- the required relative correction is A - S.
    local correction = audio_mark - subtitle_mark
    local current_delay = get_subtitle_delay_seconds()
    local new_delay = current_delay + correction

    if set_subtitle_delay_seconds(new_delay) then
        if correction > 0 then
            set_status("Synchronized. The subtitle was too early and has been delayed.")
        elseif correction < 0 then
            set_status("Synchronized. The subtitle was too late and has been advanced.")
        else
            set_status("The subtitle is already synchronized.")
        end
        refresh_delay_label()
        audio_mark = nil
        subtitle_mark = nil
    else
        set_status("Could not change subtitle delay in this VLC build.")
    end
end

function mark_audio()
    local t = get_media_time_seconds()
    if not t then
        set_status("No active video is playing.")
        return
    end

    audio_mark = t
    if subtitle_mark then
        try_apply_marks()
    else
        set_status("Speech marked. Now mark when the matching subtitle appears.")
    end
end

function mark_subtitle()
    local t = get_media_time_seconds()
    if not t then
        set_status("No active video is playing.")
        return
    end

    subtitle_mark = t
    if audio_mark then
        try_apply_marks()
    else
        set_status("Subtitle marked. Now mark when the matching line is spoken.")
    end
end

function subtitle_too_early()
    local current = get_subtitle_delay_seconds()
    if set_subtitle_delay_seconds(current + NUDGE_SECONDS) then
        set_status("Adjusted: the subtitles will appear a little later.")
        refresh_delay_label()
    else
        set_status("Could not change subtitle delay in this VLC build.")
    end
end

function subtitle_too_late()
    local current = get_subtitle_delay_seconds()
    if set_subtitle_delay_seconds(current - NUDGE_SECONDS) then
        set_status("Adjusted: the subtitles will appear a little earlier.")
        refresh_delay_label()
    else
        set_status("Could not change subtitle delay in this VLC build.")
    end
end

function reset_delay()
    if set_subtitle_delay_seconds(0) then
        audio_mark = nil
        subtitle_mark = nil
        set_status("Subtitle synchronization was reset.")
        refresh_delay_label()
    else
        set_status("Could not reset subtitle delay in this VLC build.")
    end
end

function cancel_marks()
    clear_marks("Marks cleared. Start again with the same spoken line and subtitle.")
end

function activate()
    dlg = vlc.dialog("Easy Subtitle Sync")

    dlg:add_label("<b>Automatic method</b>", 1, 1, 2, 1)
    dlg:add_label("Use the same sentence. You can press the buttons in either order.", 1, 2, 2, 1)

    dlg:add_button("I hear the line NOW", mark_audio, 1, 3, 1, 1)
    dlg:add_button("The subtitle appears NOW", mark_subtitle, 2, 3, 1, 1)

    dlg:add_button("Clear the two marks", cancel_marks, 1, 4, 2, 1)

    dlg:add_label("<b>Quick adjustment</b>", 1, 5, 2, 1)
    dlg:add_button("Subtitle is too early", subtitle_too_early, 1, 6, 1, 1)
    dlg:add_button("Subtitle is too late", subtitle_too_late, 2, 6, 1, 1)

    dlg:add_button("Reset synchronization", reset_delay, 1, 7, 2, 1)

    status_label = dlg:add_label("Ready. Mark the spoken line and the matching subtitle.", 1, 8, 2, 1)
    delay_label = dlg:add_label("", 1, 9, 2, 1)

    refresh_delay_label()
end

function deactivate()
    if dlg then
        dlg:delete()
        dlg = nil
    end
end

function close()
    vlc.deactivate()
end

function input_changed()
    audio_mark = nil
    subtitle_mark = nil
    if status_label then
        set_status("New media detected. Ready to synchronize.")
        refresh_delay_label()
    end
end
