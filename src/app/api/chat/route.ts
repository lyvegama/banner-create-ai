import { NextResponse } from "next/server";

export const runtime = "nodejs";

type HistoryMessage = { role: "user" | "assistant"; content: string };

function toDataUrl(buffer: Buffer, type: string) {
  return `data:${type};base64,${buffer.toString("base64")}`;
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Falta configurar OPENAI_API_KEY en el archivo .env.local." },
      { status: 503 },
    );
  }

  const formData = await request.formData();
  const message = String(formData.get("message") || "").trim();
  const files = formData.getAll("files").filter((value): value is File => value instanceof File);
  let history: HistoryMessage[] = [];

  try {
    history = JSON.parse(String(formData.get("history") || "[]")) as HistoryMessage[];
  } catch {
    history = [];
  }

  const content: Array<Record<string, string>> = [];
  if (message) content.push({ type: "input_text", text: message });

  for (const file of files) {
    if (file.size > 10 * 1024 * 1024) continue;
    const buffer = Buffer.from(await file.arrayBuffer());
    const dataUrl = toDataUrl(buffer, file.type || "application/octet-stream");

    if (file.type.startsWith("image/")) {
      content.push({ type: "input_image", image_url: dataUrl });
    } else if (file.type === "application/pdf") {
      content.push({ type: "input_file", filename: file.name, file_data: dataUrl });
    } else if (file.type.startsWith("text/") || /\.(md|json|csv)$/i.test(file.name)) {
      content.push({ type: "input_text", text: `Contenido de ${file.name}:\n${buffer.toString("utf8")}` });
    } else {
      content.push({ type: "input_text", text: `El usuario ha adjuntado el archivo: ${file.name}` });
    }
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-5.6-luna",
      instructions:
        "Eres el asistente interno de una empresa que crea banners. Responde en español, con claridad y criterio práctico. En esta primera fase ayuda con ideas, análisis de imágenes y documentos; todavía no generes archivos de banner salvo que el usuario lo pida explícitamente.",
      input: [...history.slice(-20), { role: "user", content }],
    }),
  });

  if (!response.ok) {
    const details = await response.json().catch(() => ({})) as {
      error?: { code?: string; message?: string };
    };
    console.error("OpenAI API error", details);

    if (details.error?.code === "insufficient_quota" || details.error?.code === "credit_balance_exhausted") {
      return NextResponse.json(
        { error: "La clave funciona, pero la cuenta de OpenAI no tiene créditos disponibles. Añade saldo en Billing para continuar." },
        { status: 402 },
      );
    }

    return NextResponse.json({ error: "La IA no pudo responder. Revisa la configuración de la API." }, { status: 502 });
  }

  const data = await response.json() as {
    output_text?: string;
    output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  };
  const outputText = data.output_text || data.output
    ?.flatMap((item) => item.content || [])
    .filter((item) => item.type === "output_text" && item.text)
    .map((item) => item.text)
    .join("\n");

  return NextResponse.json({ message: outputText || "No he recibido contenido en la respuesta." });
}