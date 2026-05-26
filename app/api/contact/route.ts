import { NextRequest, NextResponse } from "next/server";

interface ContactPayload {
  name: string;
  email: string;
  message: string;
}

function validatePayload(body: unknown): body is ContactPayload {
  if (!body || typeof body !== "object") return false;
  const { name, email, message } = body as Record<string, unknown>;
  if (typeof name !== "string" || name.trim().length === 0) return false;
  if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false;
  if (typeof message !== "string" || message.trim().length < 10) return false;
  return true;
}

export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json();

    if (!validatePayload(body)) {
      return NextResponse.json(
        { error: "Invalid payload" },
        { status: 400 }
      );
    }

    const { name, email, message } = body;

    const w3fRes = await fetch("https://api.web3forms.com/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        access_key: process.env.WEB3FORMS_KEY,
        name,
        email,
        message,
        subject: `Portfolio contact from ${name}`,
      }),
    });

    const responseText = await w3fRes.text();
    let w3fData: { success?: boolean; message?: string };
    try {
      w3fData = JSON.parse(responseText);
    } catch {
      console.error("[Contact Form] Web3Forms non-JSON response:", responseText.slice(0, 200));
      return NextResponse.json({ error: "Failed to send message" }, { status: 502 });
    }

    if (!w3fData.success) {
      console.error("[Contact Form] Web3Forms error:", w3fData);
      return NextResponse.json({ error: "Failed to send message" }, { status: 502 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error("[Contact Form] Caught error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
