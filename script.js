const fileInput = document.getElementById('jsonFile');
const chatContainer = document.getElementById('chat-container');
const urlInput = document.getElementById('chatUrl'); // New URL input
const loadUrlButton = document.getElementById('loadUrlButton'); // New button

fileInput.addEventListener('change', handleFileSelect);
loadUrlButton.addEventListener('click', handleUrlLoad); // Add listener for URL load

/**
 * Handles the file selection event, reads the file, and initiates processing.
 * @param {Event} event - The file input change event.
 */
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) {
        displayError('No file selected.');
        return;
    }

    // Basic check, processing will handle actual content format
    if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
        console.warn(`File type is not application/json (Type: ${file.type}), proceeding because of .json extension.`);
    }

    const reader = new FileReader();

    reader.onload = function(e) {
        const rawText = e.target.result;
        processChatData(rawText); // Call the refactored processing function
    };

    reader.onerror = function(e) {
        console.error("Error reading file:", e);
        displayError('Error reading file.');
    };

    // Display loading message while reading
    displayInfo('Reading file...');
    reader.readAsText(file);
}

/**
 * Handles the click event for the "Load from URL" button.
 */
async function handleUrlLoad() {
    const url = urlInput.value.trim();
    if (!url) {
        displayError('Please enter a URL.');
        return;
    }

    // Basic check if it looks like a URL (not exhaustive)
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
       displayWarning('URL does not start with http:// or https://. Attempting to load anyway.');
    }

    displayInfo(`Loading data from ${url}...`); // Show loading message

    try {
        const response = await fetch(url);

        if (!response.ok) {
            // Handle HTTP errors (like 404 Not Found, 500 Internal Server Error)
            throw new Error(`HTTP error! Status: ${response.status} ${response.statusText}`);
        }

        // Check content type - warn if not JSON, but still try to process
        const contentType = response.headers.get('content-type');
        if (contentType && !contentType.includes('application/json')) {
            console.warn(`Expected application/json, but received ${contentType}. Attempting to parse anyway.`);
        }

        const rawText = await response.text();
        processChatData(rawText); // Process the fetched text

    } catch (error) {
        console.error("Error fetching or processing URL:", error);
        let userMessage = `Error loading from URL: ${error.message}.`;
        // Specifically check for network errors which might indicate CORS issues
        if (error instanceof TypeError && error.message === 'Failed to fetch') {
             userMessage += ' This might be a network issue or a CORS (Cross-Origin Resource Sharing) problem. The server hosting the URL must allow requests from this page.';
        }
        displayError(userMessage + ' Check console for more details.');
    }
}

/**
 * Processes the raw chat data string (from file or URL).
 * Parses JSON, extracts actions, and displays messages.
 * @param {string} rawText - The raw text content (expected to be JSON).
 */
function processChatData(rawText) {
    let processedText = ''; // Define outside try for error reporting
        try {
            processedText = rawText.trim();

            if (!processedText) {
            displayError('Received data is empty.');
                return;
            }

            // --- Preprocessing for Concatenated or Single JSON Objects ---
            // Check if the text is already a valid JSON array
            const isLikelyValidArray = processedText.startsWith('[') && processedText.endsWith(']');

            if (!isLikelyValidArray) {
                // Assume it's NOT a valid array (could be single object or concatenated)
                // Apply the fix: replace separators and wrap in brackets.
                console.log("Applying preprocessing for concatenated/single JSON object format.");
                processedText = processedText.replace(/}\s*{/g, '},{'); // Replace separators
                processedText = '[' + processedText + ']';            // Wrap in array brackets
            }
            // --- End Preprocessing ---

            // Now parse the potentially modified string
            const chatDataArray = JSON.parse(processedText);
            console.log("JSON parsing successful. Parsed items:", chatDataArray.length);

            // --- Data Extraction ---
            // Flatten the array of actions from all top-level items
            let chatActions = [];
            if (Array.isArray(chatDataArray)) {
                chatActions = chatDataArray.flatMap(item => item?.replayChatItemAction?.actions || item?.continuationContents?.liveChatContinuation?.actions || []);
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
         displayError(userMessage + ' Check console for more details.');
        }
}

/**
 * Displays an error message in the chat container.
 * @param {string} message - The error message text.
 */
function displayError(message) {
    chatContainer.innerHTML = `<p class="error">${message}</p>`;
}

/**
 * Displays a warning message in the chat container.
 * @param {string} message - The warning message text.
 */
function displayWarning(message) {
    // Prepend warning to allow content loading afterwards if needed
    const warningElement = document.createElement('p');
    warningElement.classList.add('warning');
    warningElement.textContent = message;
    chatContainer.innerHTML = ''; // Clear previous content before adding warning
    chatContainer.appendChild(warningElement);
}

/**
 * Displays an informational message (e.g., "Loading...") in the chat container.
 * @param {string} message - The informational message text.
 */
function displayInfo(message) {
    chatContainer.innerHTML = `<p class="info">${message}</p>`;
}

/**
 * Processes message runs (text and emojis) and appends them to a target HTML element.
 * @param {Array|undefined} runs - The array of run objects from the message data.
 * @param {HTMLElement} targetElement - The HTML element to append content to.
 */
function processMessageRuns(runs, targetElement) {
    if (!runs || !Array.isArray(runs)) {
        targetElement.textContent = ''; // Clear if no runs
        return;
    }
    runs.forEach(run => {
        if (run.text) {
            targetElement.appendChild(document.createTextNode(run.text));
        } else if (run.emoji) {
            const emoji = run.emoji;
            const img = document.createElement('img');
            img.classList.add('chat-emoji');
            img.src = emoji.image?.thumbnails?.[0]?.url || ''; // Use smallest thumbnail
            const altText = emoji.accessibility?.accessibilityData?.label || emoji.shortcuts?.[0] || 'emoji';
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
    chatContainer.innerHTML = ''; // Clear previous content
    let messageCount = 0;
    let skippedTickerCount = 0;
    let skippedOtherActionCount = 0;
    let skippedOtherItemCount = 0;

    if (!actions || actions.length === 0) {
        // Handle case where parsing was successful but no actions were found/extracted
        chatContainer.innerHTML = '<p>No chat actions found in the file data.</p>';
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
                 console.warn("Found addChatItemAction without an item.", addChatItemAction);
                 skippedOtherActionCount++; // Count as a skipped action/item problem
                 return;
            }

            // Determine the type of chat item renderer
            const textRenderer = item.liveChatTextMessageRenderer;
            const memberRenderer = item.liveChatMembershipItemRenderer;
            // const paidRenderer = item.liveChatPaidMessageRenderer; // Example for Super Chat
            // Add other renderers here as needed

            let rendererData = null;
            let messageTypeClass = ''; // Optional CSS class for styling specific types

            // Assign the correct renderer data and class
            if (textRenderer) {
                rendererData = textRenderer;
                // messageTypeClass = 'chat-text-message'; // Uncomment if specific styling is needed
            } else if (memberRenderer) {
                rendererData = memberRenderer;
                messageTypeClass = 'chat-membership-message';
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
            const authorPhotoUrl = rendererData.authorPhoto?.thumbnails?.[0]?.url || 'placeholder.png';
            const timestampText = rendererData.timestampText?.simpleText || '[no time]';
            const authorNameText = rendererData.authorName?.simpleText || '[unknown author]';
            const authorBadges = rendererData.authorBadges || [];

            // --- Element Creation ---
            const messageElement = document.createElement('div');
            messageElement.classList.add('chat-message');
            if (messageTypeClass) {
                messageElement.classList.add(messageTypeClass);
            }

            // 1. Author Photo
            const authorImg = document.createElement('img');
            authorImg.src = authorPhotoUrl;
            authorImg.alt = "Author";
            authorImg.classList.add('author-photo');
            authorImg.onerror = () => { authorImg.src = 'placeholder.png'; authorImg.alt = 'Default Avatar'; };
            messageElement.appendChild(authorImg);

            // 2. Message Content container
            const contentDiv = document.createElement('div');
            contentDiv.classList.add('message-content');

            // 2a. Message Header (Timestamp, Author, Badges)
            const headerDiv = document.createElement('div');
            headerDiv.classList.add('message-header');

            const timeSpan = document.createElement('span');
            timeSpan.classList.add('timestamp');
            timeSpan.textContent = timestampText;
            headerDiv.appendChild(timeSpan);

            const nameSpan = document.createElement('span');
            nameSpan.classList.add('author-name');
            nameSpan.textContent = authorNameText;
            headerDiv.appendChild(nameSpan);

            authorBadges.forEach(badgeItem => {
                const badgeRenderer = badgeItem?.liveChatAuthorBadgeRenderer;
                if (badgeRenderer?.customThumbnail?.thumbnails?.[0]?.url) {
                    const badgeImg = document.createElement('img');
                    badgeImg.src = badgeRenderer.customThumbnail.thumbnails[0].url;
                    badgeImg.alt = badgeRenderer.tooltip || 'Badge';
                    badgeImg.title = badgeRenderer.tooltip || 'Badge';
                    badgeImg.classList.add('author-badge');
                    badgeImg.onerror = () => { badgeImg.style.display = 'none'; }; // Hide if badge image fails
                    headerDiv.appendChild(badgeImg);
                }
            });
            contentDiv.appendChild(headerDiv);

            // 2b. Message Body (Processed based on renderer type)
            const bodyDiv = document.createElement('div');
            bodyDiv.classList.add('message-body');

            if (textRenderer) {
                processMessageRuns(textRenderer.message?.runs, bodyDiv);
            } else if (memberRenderer) {
                // Handle specific structure of membership messages
                 if (memberRenderer.headerPrimaryText?.runs) {
                     const primaryHeader = document.createElement('span');
                     primaryHeader.classList.add('membership-header-primary');
                     processMessageRuns(memberRenderer.headerPrimaryText.runs, primaryHeader);
                     bodyDiv.appendChild(primaryHeader);
                 }
                 if (memberRenderer.headerSubtext?.simpleText) {
                     const subHeader = document.createElement('span');
                     subHeader.classList.add('membership-header-subtext');
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
    const summary = document.createElement('p');
    let summaryText;

    // Adjust summary logic slightly for clarity
    if (messageCount === 0 && (skippedTickerCount > 0 || skippedOtherActionCount > 0 || skippedOtherItemCount > 0)) {
         summaryText = `Processed data, but found no displayable messages.`;
    } else if (messageCount === 0 && actions.length === 0) {
        // This state should be caught earlier, but acts as a fallback
        summaryText = `No chat actions found in the provided data.`;
    }
     else {
        summaryText = `Displayed ${messageCount} messages.`;
    }

    // Add counts of skipped items if any were skipped
    const skippedMessages = [];
    if (skippedTickerCount > 0) skippedMessages.push(`${skippedTickerCount} ticker`);
    if (skippedOtherItemCount > 0) skippedMessages.push(`${skippedOtherItemCount} unhandled item types`);
    if (skippedOtherActionCount > 0) skippedMessages.push(`${skippedOtherActionCount} unhandled action types`);

    if (skippedMessages.length > 0) {
        summaryText += ` (Skipped: ${skippedMessages.join(', ')})`;
    }

    summary.textContent = summaryText;
    chatContainer.prepend(summary); // Add summary to the top

    // Scroll to top after loading
    chatContainer.scrollTop = 0;
}
