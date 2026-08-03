#!/bin/bash
echo "Monitoring EPMS logs for errors..."
tail -f logs/nest.log | grep --line-buffered -i "error" | while read -r line ; do
    echo "🚨 [ALERT] ERROR DETECTED: $line"
    # Bisa tambahkan webhook notifikasi slack/discord di sini jika ada curl webhook url.
done
