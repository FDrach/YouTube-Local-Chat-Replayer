const fileInput = document.getElementById("jsonFile");
const chatContainer = document.getElementById("chat-container");
const urlInput = document.getElementById("chatUrl");
const loadUrlButton = document.getElementById("loadUrlButton");
const progressBar = document.getElementById("downloadProgress"); // Get progress bar

fileInput.addEventListener("change", handleFileSelect);
loadUrlButton.addEventListener("click", handleUrlLoad);

/**
 * Handles the file selection event, reads the file, and initiates processing.
 * @param {Event} event - The file input change event.
 */
function handleFileSelect(event) {
  progressBar.style.display = "none"; // Hide progress bar if file load is chosen
  const file = event.target.files[0];
  if (!file) {
    displayError("No file selected.");
    return;
  }

  // Basic check, processing will handle actual content format
  if (file.type !== "application/json" && !file.name.endsWith(".json")) {
    console.warn(
      `File type is not application/json (Type: ${file.type}), proceeding because of .json extension.`
    );
  }

  const reader = new FileReader();

  reader.onload = function (e) {
    const rawText = e.target.result;
    processChatData(rawText); // Call the refactored processing function
  };

  reader.onerror = function (e) {
    console.error("Error reading file:", e);
    displayError("Error reading file.");
  };

  // Display loading message while reading
  displayInfo("Reading file...");
  reader.readAsText(file);
}

/**
 * Handles the click event for the "Load from URL" button.
 */
async function handleUrlLoad() {
  const url = urlInput.value.trim();
  const cleanName = decodeURI(url.split("/").pop());
  if (!url) {
    displayError("Please enter a URL.");
    return;
  }

  // Basic check if it looks like a URL (not exhaustive)
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    displayWarning(
      "URL does not start with http:// or https://. Attempting to load anyway."
    );
    // Don't return here, let the fetch attempt happen
  }

  // Reset progress bar and display loading message initially
  progressBar.style.display = 'none'; // Keep hidden until we know if we can show determinate progress
  progressBar.removeAttribute("value");
  progressBar.removeAttribute("max");
  displayInfo(`Requesting data from ${cleanName}...`);

  try {
    const response = await fetch(url);

    if (!response.ok) {
      // Handle HTTP errors (like 404 Not Found, 500 Internal Server Error)
      throw new Error(
        `HTTP error! Status: ${response.status} ${response.statusText}`
      );
    }

    // Check for Content-Length header to enable determinate progress
    const contentLength = response.headers.get('Content-Length');
    const totalBytes = parseInt(contentLength, 10);
    let receivedBytes = 0;
    const chunks = []; // Array to store received chunks

    // --- Prepare for reading the response body ---
    if (!response.body) {
      throw new Error("Response body is not available.");
    }
    const reader = response.body.getReader();

    // --- Show progress bar ---
    // If Content-Length is available and valid, set up determinate progress
    if (!isNaN(totalBytes) && totalBytes > 0) {
        console.log(`Total size: ${totalBytes} bytes. Starting download...`);
        progressBar.max = totalBytes;
        progressBar.value = 0;
        progressBar.style.display = 'block';
        // Update info message
        displayInfo(`Downloading data from ${cleanName}... (0%)`);
    } else {
        // Otherwise, use indeterminate progress
        console.log("Content-Length not available or invalid. Using indeterminate progress.");
        progressBar.removeAttribute("value"); // Ensure it's indeterminate
        progressBar.style.display = 'block';
        // Update info message
        displayInfo(`Downloading data from ${cleanName}...`);
    }

    // --- Read the stream ---
    while (true) {
        const { done, value } = await reader.read();

        if (done) {
            break; // Stream finished
        }

        chunks.push(value); // Store the chunk (Uint8Array)
        receivedBytes += value.length;

        // Update determinate progress bar if applicable
        if (!isNaN(totalBytes) && totalBytes > 0) {
            progressBar.value = receivedBytes;
            const percent = Math.round((receivedBytes / totalBytes) * 100);
            // Update info message with percentage (optional, can be spammy for many small chunks)
            // Throttle this update if needed for performance
             displayInfo(`Downloading data from ${cleanName}... (${percent}%)`);
        }
        // No update needed for indeterminate bar here
    }

    // --- All chunks received, combine and decode ---
    progressBar.style.display = 'none'; // Hide progress bar before processing
    displayInfo("Download complete. Processing data...");

    // Concatenate chunks into a single Uint8Array
    const allChunks = new Uint8Array(receivedBytes);
    let position = 0;
    for (const chunk of chunks) {
      allChunks.set(chunk, position);
      position += chunk.length;
    }

    // Decode the Uint8Array into a string
    const rawText = new TextDecoder("utf-8").decode(allChunks);

    // --- Process the data ---
    processChatData(rawText);

  } catch (error) {
    console.error("Error fetching or processing URL:", error);
    // Hide progress bar on error
    progressBar.style.display = "none";
    let userMessage = `Error loading from URL: ${error.message}`;
    userMessage +=
      "<br> The source may be down, or you are blocking it. <br>";
    // Specifically check for network errors which might indicate CORS issues
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      userMessage +=
        " This might be a network issue or a CORS (Cross-Origin Resource Sharing) problem. The server hosting the URL must allow requests from this page.";
    }
    displayError(userMessage + " Check console for more details.");
  }
}

/**
 * Processes the raw chat data string (from file or URL).
 * Parses JSON, extracts actions, and displays messages.
 * @param {string} rawText - The raw text content (expected to be JSON).
 */
function processChatData(rawText) {
  let processedText = ""; // Define outside try for error reporting
  try {
    processedText = rawText.trim();

    if (!processedText) {
      displayError("Received data is empty.");
      return;
    }

    // --- Preprocessing for Concatenated or Single JSON Objects ---
    // Check if the text is already a valid JSON array
    const isLikelyValidArray =
      processedText.startsWith("[") && processedText.endsWith("]");

    if (!isLikelyValidArray) {
      // Assume it's NOT a valid array (could be single object or concatenated)
      // Apply the fix: replace separators and wrap in brackets.
      console.log(
        "Applying preprocessing for concatenated/single JSON object format."
      );
      processedText = processedText.replace(/}\s*{/g, "},{"); // Replace separators
      processedText = "[" + processedText + "]"; // Wrap in array brackets
    }
    // --- End Preprocessing ---

    // Now parse the potentially modified string
    const chatDataArray = JSON.parse(processedText);
    console.log("JSON parsing successful. Parsed items:", chatDataArray.length);

    // --- Data Extraction ---
    // Flatten the array of actions from all top-level items
    let chatActions = [];
    if (Array.isArray(chatDataArray)) {
      chatActions = chatDataArray.flatMap(
        (item) =>
          item?.replayChatItemAction?.actions ||
          item?.continuationContents?.liveChatContinuation?.actions ||
          []
      );
      console.log(`Extracted ${chatActions.length} actions total.`);
    } else {
      // Should not happen with preprocessing, but acts as a safeguard
      throw new Error("Internal error: Processed data is not an array.");
    }

    if (!Array.isArray(chatActions)) {
      // Should not happen with flatMap, but acts as a safeguard
      throw new Error("Internal error: chatActions is not an array.");
    }

    // Filter and process the actions
    displayChatMessages(chatActions);
  } catch (error) {
    console.error("Error during data processing:", error);
    // Log relevant info for debugging, if needed
    // console.error("Raw text snippet (first 500 chars):", rawText.substring(0, 500));
    // console.error("Processed text snippet (first 100 chars):", processedText.substring(0, 100));

    let userMessage = `Error processing data: ${error.message}.`;
    if (error instanceof SyntaxError) {
      userMessage = `Error parsing JSON: ${error.message}. The data might be corrupted or have an unexpected format.`;
    }
    // Ensure progress bar is hidden if error happens during processing too
    if (progressBar) progressBar.style.display = "none";
    displayError(userMessage + " Check console for more details.");
  }
}

/**
 * Displays an error message in the chat container.
 * @param {string} message - The error message text.
 */
function displayError(message) {
  chatContainer.innerHTML = `<p class="error">${message}</p>`;
  // Ensure progress bar is hidden when displaying an error
  if (progressBar) progressBar.style.display = "none";
}

/**
 * Displays a warning message in the chat container.
 * @param {string} message - The warning message text.
 */
function displayWarning(message) {
  // Prepend warning to allow content loading afterwards if needed
  const warningElement = document.createElement("p");
  warningElement.classList.add("warning");
  warningElement.textContent = message;
  chatContainer.innerHTML = ""; // Clear previous content before adding warning
  chatContainer.appendChild(warningElement);
  // No need to hide progress bar here, it's shown *after* this potential warning
}

/**
 * Displays an informational message (e.g., "Loading...") in the chat container.
 * @param {string} message - The informational message text.
 */
function displayInfo(message) {
  // Only update if the message content changes to avoid unnecessary redraws
  // Find the existing info paragraph if it exists
  const existingInfo = chatContainer.querySelector('p.info');
  if (existingInfo) {
      if (existingInfo.textContent !== message) {
          existingInfo.textContent = message;
      }
  } else {
      // If no info paragraph exists, clear container and add a new one
      // (This typically happens on the first call or after an error/warning)
      chatContainer.innerHTML = `<p class="info">${message}</p>`;
  }
  // Keep progress bar visible while info (like "Loading...") is shown
}

/**
 * Processes message runs (text and emojis) and appends them to a target HTML element.
 * @param {Array|undefined} runs - The array of run objects from the message data.
 * @param {HTMLElement} targetElement - The HTML element to append content to.
 */
function processMessageRuns(runs, targetElement) {
  if (!runs || !Array.isArray(runs)) {
    targetElement.textContent = ""; // Clear if no runs
    return;
  }
  runs.forEach((run) => {
    if (run.text) {
      targetElement.appendChild(document.createTextNode(run.text));
    } else if (run.emoji) {
      const emoji = run.emoji;
      const img = document.createElement("img");
      img.classList.add("chat-emoji");
      img.src = emoji.image?.thumbnails?.[0]?.url || ""; // Use smallest thumbnail
      const altText =
        emoji.accessibility?.accessibilityData?.label ||
        emoji.shortcuts?.[0] ||
        "emoji";
      img.alt = altText;
      img.title = altText; // Tooltip on hover

      img.onerror = () => {
        // Fallback if image fails to load: display alt text
        const fallbackText = document.createTextNode(`[${altText}]`);
        img.replaceWith(fallbackText);
      };

      // Only append if src is valid; otherwise, use fallback directly
      if (img.src) {
        targetElement.appendChild(img);
      } else {
        targetElement.appendChild(document.createTextNode(`[${altText}]`));
      }
    }
    // TODO: Potentially handle other run types like links if needed
  });
}

/**
 * Displays the processed chat messages in the chat container.
 * Clears previous content before displaying.
 * @param {Array} actions - The array of chat actions to display.
 */
function displayChatMessages(actions) {
  // Ensure progress bar is hidden when messages are finally displayed
  if (progressBar) progressBar.style.display = "none";
  chatContainer.innerHTML = ""; // Clear previous content (like loading message)
  let messageCount = 0;
  let skippedTickerCount = 0;
  let skippedOtherActionCount = 0;
  let skippedOtherItemCount = 0;

  if (!actions || actions.length === 0) {
    // Handle case where parsing was successful but no actions were found/extracted
    chatContainer.innerHTML =
      "<p>No chat actions found in the provided data.</p>";
    return;
  }

  actions.forEach((action) => {
    // Determine the type of action
    const addChatItemAction = action?.addChatItemAction;
    const addTickerItemAction = action?.addLiveChatTickerItemAction;

    if (addChatItemAction) {
      const item = addChatItemAction.item;
      if (!item) {
        // This indicates a data structure issue
        console.warn(
          "Found addChatItemAction without an item.",
          addChatItemAction
        );
        skippedOtherActionCount++; // Count as a skipped action/item problem
        return;
      }

      // Determine the type of chat item renderer
      const textRenderer = item.liveChatTextMessageRenderer;
      const memberRenderer = item.liveChatMembershipItemRenderer;
      // const paidRenderer = item.liveChatPaidMessageRenderer; // Example for Super Chat
      // Add other renderers here as needed

      let rendererData = null;
      let messageTypeClass = ""; // Optional CSS class for styling specific types

      // Assign the correct renderer data and class
      if (textRenderer) {
        rendererData = textRenderer;
        // messageTypeClass = 'chat-text-message'; // Uncomment if specific styling is needed
      } else if (memberRenderer) {
        rendererData = memberRenderer;
        messageTypeClass = "chat-membership-message";
      }
      // else if (paidRenderer) { rendererData = paidRenderer; messageTypeClass = 'chat-paid-message'; }
      else {
        // Skip item types we don't explicitly handle
        skippedOtherItemCount++;
        // console.log("Skipping unhandled item type:", Object.keys(item)[0]); // Uncomment for debugging
        return;
      }

      messageCount++;

      // --- Common Data Extraction ---
      const authorPhotoUrl =
        rendererData.authorPhoto?.thumbnails?.[0]?.url || "placeholder.png";
      const timestampText =
        rendererData.timestampText?.simpleText || "[no time]";
      const authorNameText =
        rendererData.authorName?.simpleText || "[unknown author]";
      const authorBadges = rendererData.authorBadges || [];

      // --- Element Creation ---
      const messageElement = document.createElement("div");
      messageElement.classList.add("chat-message");
      if (messageTypeClass) {
        messageElement.classList.add(messageTypeClass);
      }

      // 1. Author Photo
      const authorImg = document.createElement("img");
      authorImg.src = authorPhotoUrl;
      authorImg.alt = "Author";
      authorImg.classList.add("author-photo");
      authorImg.onerror = () => {
        authorImg.src = "placeholder.png";
        authorImg.alt = "Default Avatar";
      };
      messageElement.appendChild(authorImg);

      // 2. Message Content container
      const contentDiv = document.createElement("div");
      contentDiv.classList.add("message-content");

      // 2a. Message Header (Timestamp, Author, Badges)
      const headerDiv = document.createElement("div");
      headerDiv.classList.add("message-header");

      const timeSpan = document.createElement("span");
      timeSpan.classList.add("timestamp");
      timeSpan.textContent = timestampText;
      headerDiv.appendChild(timeSpan);

      const nameSpan = document.createElement("span");
      nameSpan.classList.add("author-name");
      nameSpan.textContent = authorNameText;
      headerDiv.appendChild(nameSpan);

      authorBadges.forEach((badgeItem) => {
        const badgeRenderer = badgeItem?.liveChatAuthorBadgeRenderer;
        if (badgeRenderer?.customThumbnail?.thumbnails?.[0]?.url) {
          const badgeImg = document.createElement("img");
          badgeImg.src = badgeRenderer.customThumbnail.thumbnails[0].url;
          badgeImg.alt = badgeRenderer.tooltip || "Badge";
          badgeImg.title = badgeRenderer.tooltip || "Badge";
          badgeImg.classList.add("author-badge");
          badgeImg.onerror = () => {
            badgeImg.style.display = "none";
          }; // Hide if badge image fails
          headerDiv.appendChild(badgeImg);
        }
      });
      contentDiv.appendChild(headerDiv);

      // 2b. Message Body (Processed based on renderer type)
      const bodyDiv = document.createElement("div");
      bodyDiv.classList.add("message-body");

      if (textRenderer) {
        processMessageRuns(textRenderer.message?.runs, bodyDiv);
      } else if (memberRenderer) {
        // Handle specific structure of membership messages
        if (memberRenderer.headerPrimaryText?.runs) {
          const primaryHeader = document.createElement("span");
          primaryHeader.classList.add("membership-header-primary");
          processMessageRuns(
            memberRenderer.headerPrimaryText.runs,
            primaryHeader
          );
          bodyDiv.appendChild(primaryHeader);
        }
        if (memberRenderer.headerSubtext?.simpleText) {
          const subHeader = document.createElement("span");
          subHeader.classList.add("membership-header-subtext");
          subHeader.textContent = memberRenderer.headerSubtext.simpleText;
          bodyDiv.appendChild(subHeader);
        }
        // Membership items can also have a 'message' part (e.g., welcome emojis)
        if (memberRenderer.message?.runs) {
          processMessageRuns(memberRenderer.message.runs, bodyDiv);
        }
      }
      // else if (paidRenderer) { /* Process super chat body */ }

      contentDiv.appendChild(bodyDiv);
      messageElement.appendChild(contentDiv);
      chatContainer.appendChild(messageElement); // Add the complete message element
    } else if (addTickerItemAction) {
      // Silently skip ticker items, just count them
      skippedTickerCount++;
    } else {
      // Skip other action types we don't handle
      skippedOtherActionCount++;
      // console.log("Skipping unhandled action type:", Object.keys(action)[0]); // Uncomment for debugging
    }
  });

  // --- Summary Message ---
  const summary = document.createElement("p");
  let summaryText;

  // Adjust summary logic slightly for clarity
  if (
    messageCount === 0 &&
    (skippedTickerCount > 0 ||
      skippedOtherActionCount > 0 ||
      skippedOtherItemCount > 0)
  ) {
    summaryText = `Processed data, but found no displayable messages.`;
  } else if (messageCount === 0 && actions.length === 0) {
    // This state should be caught earlier, but acts as a fallback
    summaryText = `No chat actions found in the provided data.`;
  } else {
    summaryText = `Displayed ${messageCount} messages.`;
  }

  // Add counts of skipped items if any were skipped
  const skippedMessages = [];
  if (skippedTickerCount > 0)
    skippedMessages.push(`${skippedTickerCount} ticker`);
  if (skippedOtherItemCount > 0)
    skippedMessages.push(`${skippedOtherItemCount} unhandled item types`);
  if (skippedOtherActionCount > 0)
    skippedMessages.push(`${skippedOtherActionCount} unhandled action types`);

  if (skippedMessages.length > 0) {
    summaryText += ` (Skipped: ${skippedMessages.join(", ")})`;
  }

  summary.textContent = summaryText;
  chatContainer.prepend(summary); // Add summary to the top

  // Scroll to top after loading
  chatContainer.scrollTop = 0;
}
