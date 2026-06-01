// api/update.js
// 每天早上8時自動執行，搜尋墨爾本最新活動並儲存
// Vercel Cron Job: 0 8 * * *

import Anthropic from "@anthropic-ai/sdk";
import { put } from "@vercel/blob";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function searchMelbourneEvents() {
  const today = new Date().toISOString().slice(0, 10);
  const messages = [{ role: "user", content: `Search the web for Melbourne Australia events and activities happening in the next 30 days from ${today}. Include festivals, markets, sports, concerts, exhibitions, food events, family activities, community events. For each event provide name, dates, venue, address, hours, description, category, and ticket price if applicable. Find at least 15-20 events.` }];

  // Agentic loop to handle tool_use
  for (let i = 0; i < 10; i++) {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages,
    });

    messages.push({ role: "assistant", content: response.content });

    if (response.stop_reason === "end_turn") {
      return response.content.filter(b => b.type === "text").map(b => b.text).join("\n");
    }

    if (response.stop_reason === "tool_use") {
      const toolResults = response.content
        .filter(b => b.type === "tool_use")
        .map(b => ({
          type: "tool_result",
          tool_use_id: b.id,
          content: typeof b.content === "string" ? b.content : JSON.stringify(b.content || ""),
        }));
      messages.push({ role: "user", content: toolResults });
    }
  }
  throw new Error("Search loop exceeded");
}

async function convertToJSON(searchText, today) {
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4000,
    messages: [{
      role: "user",
      content: `Convert these Melbourne events into a JSON array. Today is ${today}.

Events:
${searchText}

Output ONLY a valid JSON array, no other text. Each object:
{
  "id": unique number,
  "name": "Event name in Traditional Chinese if possible",
  "emoji": "one relevant emoji",
  "category": "one of: 藝術節/體育/音樂/市集/美食/展覽/家庭/喜劇/電影/節慶/文化/表演",
  "color": "hex color matching category",
  "fixedStart": "YYYY-MM-DD",
  "fixedEnd": "YYYY-MM-DD",
  "daysOfWeek": [0,1,2,3,4,5,6],
  "hours": "opening hours in Chinese",
  "location": "venue name",
  "address": "full Melbourne address",
  "venueLat": latitude number,
  "venueLng": longitude number,
  "description": "1-2 sentence description in Traditional Chinese",
  "dateDesc": "date range in Traditional Chinese",
  "price": "price info or 免費"
}

Return [] if no events found.`
    }]
  });

  const text = response.content.filter(b => b.type === "text").map(b => b.text).join("").trim();
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1) return [];
  return JSON.parse(text.slice(start, end + 1));
}

export default async function handler(req, res) {
  // Allow manual trigger via GET, or Vercel cron via GET
  try {
    console.log("🔍 Starting Melbourne events search...");
    const today = new Date().toISOString().slice(0, 10);

    // Step 1: Search
    const searchText = await searchMelbourneEvents();
    console.log("✅ Search complete");

    // Step 2: Convert to JSON
    const events = await convertToJSON(searchText, today);
    console.log(`✅ Found ${events.length} events`);

    // Step 3: Save to Vercel Blob storage
    const data = {
      lastUpdated: today,
      updatedAt: new Date().toISOString(),
      events,
    };

    await put("events.json", JSON.stringify(data), {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
    });

    console.log("✅ Saved to storage");
    res.status(200).json({ success: true, count: events.length, lastUpdated: today });

  } catch (error) {
    console.error("❌ Error:", error);
    res.status(500).json({ error: error.message });
  }
}
