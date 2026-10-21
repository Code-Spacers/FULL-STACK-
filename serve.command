#!/bin/bash
cd "$(dirname "$0")"
PORT=8765
echo "NIVARA is starting at http://localhost:$PORT"
echo "Open that address in your browser (do NOT open the .html files directly —"
echo "ES modules are blocked over file:// and the map will not load)."
echo "Press Control+C to stop."
( sleep 1 && open "http://localhost:$PORT/index.html" ) &
python3 -m http.server "$PORT"
