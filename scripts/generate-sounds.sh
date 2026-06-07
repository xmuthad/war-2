#!/bin/bash
# 生成占位音效文件

SOUNDS_DIR="public/assets/sounds"
MUSIC_DIR="$SOUNDS_DIR/music"
VOICES_DIR="$SOUNDS_DIR/voices"

# 生成短促的提示音 (0.1秒)
generate_beep() {
    local filename=$1
    local freq=$2
    local duration=${3:-0.1}
    ffmpeg -f lavfi -i "sine=frequency=${freq}:duration=${duration}" \
           -af "volume=0.5,afade=t=in:st=0:d=0.01,afade=t=out:st=$(echo "$duration - 0.02" | bc):d=0.01" \
           -y "$SOUNDS_DIR/${filename}.mp3" 2>/dev/null
    echo "Generated: ${filename}.mp3 (${freq}Hz, ${duration}s)"
}

# 生成建筑放置音效 (下降音调)
generate_building_place() {
    ffmpeg -f lavfi -i "sine=frequency=600:duration=0.15" \
           -af "volume=0.6,afade=t=in:st=0:d=0.01,afade=t=out:st=0.12:d=0.03" \
           -y "$SOUNDS_DIR/building_place.mp3" 2>/dev/null
    echo "Generated: building_place.mp3"
}

# 生成建筑完成音效 (上升音调)
generate_building_complete() {
    ffmpeg -f lavfi -i "sine=frequency=400:duration=0.2" \
           -af "volume=0.7,asetrate=44100*1.2,afade=t=in:st=0:d=0.01,afade=t=out:st=0.17:d=0.03" \
           -y "$SOUNDS_DIR/building_complete.mp3" 2>/dev/null
    echo "Generated: building_complete.mp3"
}

# 生成建筑开始音效 (持续低音)
generate_building_start() {
    ffmpeg -f lavfi -i "sine=frequency=200:duration=0.3" \
           -af "volume=0.5,afade=t=in:st=0:d=0.02,afade=t=out:st=0.25:d=0.05" \
           -y "$SOUNDS_DIR/building_start.mp3" 2>/dev/null
    echo "Generated: building_start.mp3"
}

# 生成UI点击音效
generate_ui_click() {
    ffmpeg -f lavfi -i "sine=frequency=800:duration=0.05" \
           -af "volume=0.5,afade=t=in:st=0:d=0.005,afade=t=out:st=0.04:d=0.01" \
           -y "$SOUNDS_DIR/ui_click.mp3" 2>/dev/null
    echo "Generated: ui_click.mp3"
}

# 生成UI选择音效
generate_ui_select() {
    ffmpeg -f lavfi -i "sine=frequency=1000:duration=0.08" \
           -af "volume=0.6,afade=t=in:st=0:d=0.01,afade=t=out:st=0.06:d=0.02" \
           -y "$SOUNDS_DIR/ui_select.mp3" 2>/dev/null
    echo "Generated: ui_select.mp3"
}

# 生成UI错误音效
generate_ui_error() {
    ffmpeg -f lavfi -i "sine=frequency=200:duration=0.2" \
           -af "volume=0.4,afade=t=in:st=0:d=0.01,afade=t=out:st=0.17:d=0.03" \
           -y "$SOUNDS_DIR/ui_error.mp3" 2>/dev/null
    echo "Generated: ui_error.mp3"
}

# 生成单位移动音效
generate_unit_move() {
    ffmpeg -f lavfi -i "sine=frequency=300:duration=0.15" \
           -af "volume=0.5,asetrate=44100*0.9,afade=t=in:st=0:d=0.02,afade=t=out:st=0.12:d=0.03" \
           -y "$SOUNDS_DIR/unit_move.mp3" 2>/dev/null
    echo "Generated: unit_move.mp3"
}

# 生成单位攻击音效
generate_unit_attack() {
    ffmpeg -f lavfi -i "sine=frequency=150:duration=0.25" \
           -af "volume=0.7,asetrate=44100*0.8,afade=t=in:st=0:d=0.01,afade=t=out:st=0.22:d=0.03" \
           -y "$SOUNDS_DIR/unit_attack.mp3" 2>/dev/null
    echo "Generated: unit_attack.mp3"
}

# 生成单位选择音效
generate_unit_select() {
    ffmpeg -f lavfi -i "sine=frequency=1200:duration=0.1" \
           -af "volume=0.6,afade=t=in:st=0:d=0.01,afade=t=out:st=0.08:d=0.02" \
           -y "$SOUNDS_DIR/unit_select.mp3" 2>/dev/null
    echo "Generated: unit_select.mp3"
}

# 生成单位被摧毁音效
generate_unit_destroyed() {
    ffmpeg -f lavfi -i "sine=frequency=100:duration=0.4" \
           -af "volume=0.8,asetrate=44100*0.7,afade=t=in:st=0:d=0.02,afade=t=out:st=0.35:d=0.05" \
           -y "$SOUNDS_DIR/unit_destroyed.mp3" 2>/dev/null
    echo "Generated: unit_destroyed.mp3"
}

# 生成资源收集音效
generate_resource_collect() {
    ffmpeg -f lavfi -i "sine=frequency=1500:duration=0.1" \
           -af "volume=0.3,afade=t=in:st=0:d=0.01,afade=t=out:st=0.08:d=0.02" \
           -y "$SOUNDS_DIR/resource_collect.mp3" 2>/dev/null
    echo "Generated: resource_collect.mp3"
}

# 生成爆炸音效
generate_explosion() {
    ffmpeg -f lavfi -i "sine=frequency=60:duration=0.5" \
           -af "volume=0.8,asetrate=44100*0.6,afade=t=in:st=0:d=0.01,afade=t=out:st=0.45:d=0.05" \
           -y "$SOUNDS_DIR/explosion.mp3" 2>/dev/null
    echo "Generated: explosion.mp3"
}

# 生成子弹音效
generate_bullet() {
    ffmpeg -f lavfi -i "sine=frequency=2000:duration=0.05" \
           -af "volume=0.4,afade=t=in:st=0:d=0.005,afade=t=out:st=0.04:d=0.01" \
           -y "$SOUNDS_DIR/bullet.mp3" 2>/dev/null
    echo "Generated: bullet.mp3"
}

# 生成雷达音效
generate_radar_ping() {
    ffmpeg -f lavfi -i "sine=frequency=2500:duration=0.15" \
           -af "volume=0.5,afade=t=in:st=0:d=0.01,afade=t=out:st=0.13:d=0.02" \
           -y "$SOUNDS_DIR/radar_ping.mp3" 2>/dev/null
    echo "Generated: radar_ping.mp3"
}

# 生成警报音效
generate_alert() {
    ffmpeg -f lavfi -i "sine=frequency=500:duration=0.3" \
           -af "volume=0.7,asetrate=44100*1.1,afade=t=in:st=0:d=0.01,afade=t=out:st=0.27:d=0.03" \
           -y "$SOUNDS_DIR/alert.mp3" 2>/dev/null
    echo "Generated: alert.mp3"
}

# 生成升级完成音效
generate_upgrade_complete() {
    ffmpeg -f lavfi -i "sine=frequency=800:duration=0.3" \
           -af "volume=0.6,asetrate=44100*1.2,afade=t=in:st=0:d=0.02,afade=t=out:st=0.26:d=0.04" \
           -y "$SOUNDS_DIR/upgrade_complete.mp3" 2>/dev/null
    echo "Generated: upgrade_complete.mp3"
}

# 生成音乐
generate_music_battle() {
    ffmpeg -f lavfi -i "sine=frequency=220:duration=30" \
           -af "volume=0.3,asetrate=44100*1.0,afade=t=in:st=0:d=2,afade=t=out:st=28:d=2" \
           -y "$MUSIC_DIR/battle.mp3" 2>/dev/null
    echo "Generated: battle.mp3"
}

generate_music_calm() {
    ffmpeg -f lavfi -i "sine=frequency=330:duration=30" \
           -af "volume=0.3,asetrate=44100*1.0,afade=t=in:st=0:d=2,afade=t=out:st=28:d=2" \
           -y "$MUSIC_DIR/calm.mp3" 2>/dev/null
    echo "Generated: calm.mp3"
}

generate_music_menu() {
    ffmpeg -f lavfi -i "sine=frequency=440:duration=30" \
           -af "volume=0.3,asetrate=44100*1.0,afade=t=in:st=0:d=2,afade=t=out:st=28:d=2" \
           -y "$MUSIC_DIR/menu.mp3" 2>/dev/null
    echo "Generated: menu.mp3"
}

# 生成语音 (简单提示音)
generate_voice() {
    local filename=$1
    local freq=$2
    ffmpeg -f lavfi -i "sine=frequency=${freq}:duration=0.5" \
           -af "volume=0.6,asetrate=44100*1.1,afade=t=in:st=0:d=0.02,afade=t=out:st=0.45:d=0.05" \
           -y "$VOICES_DIR/${filename}.mp3" 2>/dev/null
    echo "Generated: ${filename}.mp3"
}

echo "🎵 正在生成音效文件..."

# 生成所有音效
generate_building_place
generate_building_complete
generate_building_start
generate_ui_click
generate_ui_select
generate_ui_error
generate_unit_move
generate_unit_attack
generate_unit_select
generate_unit_destroyed
generate_resource_collect
generate_explosion
generate_bullet
generate_radar_ping
generate_alert
generate_upgrade_complete

# 生成音乐
generate_music_battle
generate_music_calm
generate_music_menu

# 生成语音
generate_voice "voice_ack_1" 600
generate_voice "voice_ack_2" 650
generate_voice "voice_ack_3" 700
generate_voice "voice_move_1" 500
generate_voice "voice_move_2" 550
generate_voice "voice_attack_1" 450
generate_voice "voice_attack_2" 400
generate_voice "voice_help_1" 700
generate_voice "voice_death_1" 300

echo ""
echo "✅ 音效文件生成完成！"
echo "📍 文件位置: public/assets/sounds/"