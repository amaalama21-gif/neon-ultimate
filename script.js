const API_KEY = "PASTE YOUR KEY HERE";
const API_URL = "https://api.groq.com/openai/v1/chat/completions";

let chatHistory = JSON.parse(localStorage.getItem('neonMemory')) || [];
let recognition;

// SEARCH GOOGLE
async function searchWeb(query) {
    try {
        const res = await fetch(`https://api.duckgo.com/?q=${encodeURIComponent(query)}&format=json`);
        const data = await res.json();
        return data.Abstract || data.Answer || "No web result";
    } catch {
        return "Could not search web";
    }
}

// SEARCH GITHUB
async function searchGitHub(query) {
    try {
        const res = await fetch(`https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=3`);
        const data = await res.json();

        if(data.items && data.items.length > 0) {
            let result = "Top GitHub Repos:\n";
            data.items.forEach(repo => {
                result += `- **${repo.name}**: ${repo.description || "No description"} \n Link: ${repo.html_url}\n Stars: ${repo.stargazers_count}\n\n`;
            });
            return result;
        }
        return "No GitHub repos found";
    } catch {
        return "Could not search GitHub";
    }
}

function addMessage(message, sender) {
    const messagesDiv = document.getElementById("messages");
    const messageDiv = document.createElement("div");
    messageDiv.classList.add("message", sender);
    messageDiv.innerHTML = message.replace(/\n/g, '<br>'); // line breaks
    messagesDiv.appendChild(messageDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function saveMemory() {
    localStorage.setItem('neonMemory', JSON.stringify(chatHistory));
}

function clearMemory() {
    chatHistory = [];
    localStorage.removeItem('neonMemory');
    document.getElementById("messages").innerHTML = '<div class="message bot">Memory wiped bro 🧠✨</div>';
}

async function sendMessage() {
    const userInput = document.getElementById("userInput").value;
    if (!userInput) return;

    addMessage(userInput, "user");
    chatHistory.push({role: "user", content: userInput});
    document.getElementById("userInput").value = "";

    addMessage("Searching Google + GitHub for you... 🔍", "bot");

    // SEARCH BOTH
    const [webResults, githubResults] = await Promise.all([
        searchWeb(userInput),
        searchGitHub(userInput)
    ]);

    let systemPrompt = `You are NeonGPT. Use this info to answer:
    WEB: ${webResults}
    GITHUB: ${githubResults}
    Be helpful, give links, and code examples.`;

    if(userInput.toLowerCase().includes("code") || userInput.includes("github") || userInput.includes("repo")) {
        systemPrompt = `You are NeonGPT Dev Mode. Use this GitHub + Web info:
        GITHUB: ${githubResults}
        WEB: ${webResults}
        Give code, explain it, and link the repo.`;
    }

    const messagesToSend = [
        {role: "system", content: systemPrompt},
     ...chatHistory.slice(-10)
    ];

    try {
        document.getElementById("messages").lastChild.remove();

        const response = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${API_KEY}`
            },
            body: JSON.stringify({
                model: "llama-3.1-8b-instant",
                messages: messagesToSend
            })
        });

        const data = await response.json();
        const botReply = data.choices[0].message.content;

        chatHistory.push({role: "assistant", content: botReply});
        saveMemory();

        addMessage(botReply, "bot");
        speak(botReply);

    } catch (error) {
        document.getElementById("messages").lastChild.remove();
        addMessage("Error: " + error.message, "bot");
    }
}

// VOICE INPUT
function toggleVoice() {
    if(!('webkitSpeechRecognition' in window)) {
        alert("Use Chrome or Edge for voice bro");
        return;
    }
    const micBtn = document.getElementById("micBtn");
    recognition = new webkitSpeechRecognition();
    recognition.lang = 'en-US';
    recognition.onstart = () => { micBtn.classList.add("listening"); }
    recognition.onresult = (e) => {
        document.getElementById("userInput").value = e.results[0][0].transcript;
        sendMessage();
    }
    recognition.onend = () => { micBtn.classList.remove("listening"); }
    recognition.start();
}

// VOICE OUTPUT
function speak(text) {
    text = text.replace(/```[\s\S]*?```/g, "Here's the code").replace(/https?:\/\/[^\s]+/g, "link");
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.1;
    speechSynthesis.speak(utterance);
}
