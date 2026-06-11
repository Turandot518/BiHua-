/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

// Initialize Gemini Client
const apiKey = process.env.GEMINI_API_KEY;
let aiClient: GoogleGenAI | null = null;

if (apiKey) {
  aiClient = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
}

const DEFAULT_CULTURAL_DATA = [
  {
    heading: "今日壁画推荐",
    title: "莫高窟第148窟：棺盖自启为母说法",
    dynasty: "盛唐",
    content: "此画生动再现了释迦牟尼佛涅槃后，圣母摩耶夫人自天降临悲泣、佛陀自棺盖中神异坐起为面见慈母说法的孝悌场景。用线圆润饱满、顿挫有致，具有吴道子‘吴带当风’之神韵，是莫高窟大体量经变画的杰出代表，极具大唐丰肌秀骨、宏阔瑰丽的艺术气象。",
    source: "敦煌研究院官方经典丛书",
    tags: ["莫高窟", "盛唐艺术", "经变壁画"]
  },
  {
    heading: "今日壁画推荐",
    title: "莫高窟第285窟：五百强盗成佛品",
    dynasty: "西魏",
    content: "描绘了五百强盗起义被捕、囚禁受刑、遇佛得救，最终剃度出家在山林禅修成佛的完整传奇。画面洋溢着动势，人物造型清秀、飘逸（秀骨清像），带有鲜明的南朝名士之风，背景深山大泽中猿猴戏耍、群兽奔跃，生机盎然，是中国早期佛教艺术本土化转型的最高巅峰。",
    source: "莫高窟数字化勘察研究",
    tags: ["第285窟", "西魏风骨", "叙事艺术"]
  },
  {
    heading: "敦煌学术动态",
    title: "敦煌研究院数字化保护工程新进展",
    dynasty: "当代",
    content: "敦煌研究院通过激光扫描、超高清数字化摄影及三维重建技术，实现了近300个洞窟壁画与彩塑的高保真彩色数字资产建档，并上线‘数字敦煌’全球共享平台，让全球游客能够跨越时间与地理限制，纤毫毕现地畅游数字壁画世界，永续留存大漠瑰宝神韵。",
    source: "敦煌研究院新闻公布",
    tags: ["数字敦煌", "文化保护", "高保真学术例证"]
  }
];

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route: 获取基于 Search Grounding 的最新动态和每日一画推荐
  app.get("/api/dunhuang-today", async (req, res) => {
    try {
      if (!aiClient) {
        console.warn("GEMINI_API_KEY not found. Using fallback cultural data.");
        const randomItem = DEFAULT_CULTURAL_DATA[Math.floor(Math.random() * DEFAULT_CULTURAL_DATA.length)];
        return res.json({ success: true, isFallback: true, data: randomItem });
      }

      console.log("Calling Gemini API with Search Grounding...");
      const targetQuery = "查询敦煌研究院（莫高窟）的最新馆内动态、重大考古发现、学术文化保护活动，或者推荐一幅今天的敦煌经典壁画'每日一画'。";
      
      const response = await aiClient.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `
          根据最新的网络和搜索引擎，进行敦煌研究院（莫高窟）动态查询："${targetQuery}"

          请针对查询结果，为我们的敦煌壁画复原交互网页整理出一份精美的【每日文化动态或壁画推荐】。
          如果是最瞩目的近期新发现/修缮/学术/保护活动，请做成‘敦煌最新动态’；如果是经典壁画介绍，请做成‘每日一画推荐’。
          请严格返回以下格式的 JSON 数据，格式如下：
          {
            "heading": "推荐的分类（必须为'每日一画推荐' 或 '敦煌最新动态'之一）",
            "title": "具体壁画名称/石窟号（如'莫高窟第148窟：药师经变'）或新闻动态标题",
            "dynasty": "朝代（如'盛唐'，'西魏'等，如果是新闻动态则可写'当代'）",
            "content": "生动有趣的详细介绍、艺术赏析或者新闻背景介绍，要求文字富有雅致的国风美感、通俗易懂，必须控制在150到250字之间。",
            "source": "该信息的来源/参考出处",
            "tags": ["三个代表性的标签，如 '莫高窟', '唐代壁画', '飞天' 等"]
          }

          请确保返回的 JSON 数据绝对合法、没有任何格式破损。必须包含以上属性，不要包含 Markdown 书写符 \`\`\` 以外的任何干扰字符，只包含一个合法的 JSON 字符串。
        `,
        config: {
          tools: [{ googleSearch: {} }],
        }
      });

      const responseText = response.text || "";
      console.log("Gemini API Response text length:", responseText.length);

      // Clean and extract JSON code blocks
      let cleanJson = responseText.trim();
      if (cleanJson.includes("```")) {
        const matches = cleanJson.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (matches && matches[1]) {
          cleanJson = matches[1].trim();
        }
      }

      try {
        const parsedData = JSON.parse(cleanJson);
        if (parsedData.heading && parsedData.title && parsedData.content) {
          return res.json({ success: true, isFallback: false, data: parsedData });
        } else {
          throw new Error("Missing required fields in parsed JSON data.");
        }
      } catch (parseErr) {
        console.error("JSON parsing error:", parseErr, "Raw output was:", responseText);
        // Secondary attempt to match basic fields using simple regex if parsing failed
        const headingMatch = responseText.match(/"heading"\s*:\s*"([^"]+)"/);
        const titleMatch = responseText.match(/"title"\s*:\s*"([^"]+)"/);
        const dynastyMatch = responseText.match(/"dynasty"\s*:\s*"([^"]+)"/);
        const contentMatch = responseText.match(/"content"\s*:\s*"([^"]+)"/);
        const sourceMatch = responseText.match(/"source"\s*:\s*"([^"]+)"/);

        if (headingMatch && titleMatch && contentMatch) {
          const regexData = {
            heading: headingMatch[1],
            title: titleMatch[1],
            dynasty: dynastyMatch ? dynastyMatch[1] : "敦煌",
            content: contentMatch[1],
            source: sourceMatch ? sourceMatch[1] : "敦煌研究院",
            tags: ["莫高窟", "敦煌文化", "千年沉淀"]
          };
          return res.json({ success: true, isFallback: false, data: regexData });
        }
        throw new Error("Both JSON parse and regex failover failed.");
      }

    } catch (err) {
      console.error("Failed to fetch Dunhuang dynamic news:", err);
      const randomItem = DEFAULT_CULTURAL_DATA[Math.floor(Math.random() * DEFAULT_CULTURAL_DATA.length)];
      return res.json({ success: true, isFallback: true, data: randomItem, error: String(err) });
    }
  });

  // Vite middleware setup for assets and HTML serving
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

startServer();
