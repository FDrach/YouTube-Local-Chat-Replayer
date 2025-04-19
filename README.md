# YouTube-Local-Chat-Replayer

A simple web-based tool to view YouTube live chat replay messages loaded from a local JSON file. This allows you to browse chat history offline or preserve chat logs independently of YouTube.

## Features

*   **Load Local Chat Files:** Opens and displays chat messages from `.json` files downloaded from YouTube.
*   **Handles Common Formats:** Parses standard YouTube chat replay JSON arrays and attempts to fix common issues like concatenated JSON objects within a single file.
*   **Displays Key Information:** Shows:
    *   Author Profile Picture
    *   Timestamp
    *   Author Name
    *   Author Badges (Membership, Moderator, etc.)
    *   Message Text
    *   Standard & Custom Emojis (rendered as images using YouTube URLs)
*   **Supports Message Types:** Currently displays standard text messages and membership announcement messages.
*   **Basic Summary:** Provides a count of displayed messages and skipped items (like ticker messages or unhandled message types).
*   **Simple Interface:** Clean display using standard HTML and CSS. Uses the "Noto Sans" font (fetched from Google Fonts).

## How to Use

1.  **Get the Code:** Download or clone this repository.
2.  **Get a YouTube Chat JSON File:** You need a separate tool to download the chat replay from a YouTube video or stream. A highly recommended tool is `yt-dlp`.
    *   Install `yt-dlp` (see its documentation: [https://github.com/yt-dlp/yt-dlp](https://github.com/yt-dlp/yt-dlp)).
    *   Use a command like the following to download *only* the live chat to a JSON file:
        ```bash
        yt-dlp --write-sub --sub-lang live_chat --skip-download <YOUTUBE_VIDEO_URL>
        ```
    *   This will save a `.live_chat.json` file in the current directory. This is the file you'll load into the replayer.
3.  **Open the Replayer:** Open the `index.html` file in your web browser.
4.  **Load the File:** Click the "Choose File" button and select the `.live_chat.json` file you downloaded in step 2.
5.  **View the Chat:** The chat messages will be displayed in the chat container.

## Known Issues & Limitations

*   **No Video Sync:** Currently, this tool *only* displays the chat log. There is no associated video playback or synchronization.
*   **Limited Message Type Support:** Only standard text messages and membership announcements are fully parsed and displayed. Super Chats, polls, stickers, and other event types might be skipped or displayed incompletely.
*   **Emoji Dependency:** Custom emojis rely on YouTube's image URLs being accessible. If YouTube changes these URLs or if you are offline, these emojis may not display correctly (fallback to alt text is implemented).
*   **Performance:** Very large chat files (millions of messages) might impact browser performance, although basic loading should work.
*   **Error Handling:** Basic error handling for file reading and JSON parsing is included, but malformed files might still cause issues.

## Future Plans (TODO)

*   **[ ] Local Video Sync:** Add the ability to load a local video file and synchronize its playback with the timestamps in the loaded chat JSON.
*   **[ ] YouTube Video Sync (with Local Chat Backup):** Allow specifying a YouTube video URL. Play the video from YouTube but display the chat messages from the loaded local JSON file, synced to the video timeline. This provides a way to view chat even if YouTube's replay is unavailable or if you prefer your local backup.
*   **[ ] Enhanced Message Support:** Add parsing and display logic for more message types (Super Chat, Super Stickers, Polls, etc.).
*   **[ ] Playback Controls:** Implement controls (play/pause, seek) that affect both the (future) video and the corresponding chat display timing.
*   **[ ] UI/UX Improvements:** Enhance the user interface, potentially adding search, filtering, or user highlighting.

## License

This project is licensed under the **GNU General Public License v2.0**.
