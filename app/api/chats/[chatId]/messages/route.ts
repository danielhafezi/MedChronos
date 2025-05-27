import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

// POST /api/chats/[chatId]/messages - Add a message to a chat
export async function POST(
  request: NextRequest,
  { params }: { params: { chatId: string } }
) {
  try {
    const { role, content } = await request.json();

    if (!role || !content) {
      return NextResponse.json(
        { error: "Role and content are required" },
        { status: 400 }
      );
    }

    const message = await prisma.chatMessage.create({
      data: {
        chatId: params.chatId,
        role,
        content,
      },
    });

    // Update chat's updatedAt timestamp
    await prisma.chat.update({
      where: { id: params.chatId },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json(message);
  } catch (error) {
    console.error("Error creating message:", error);
    return NextResponse.json(
      { error: "Failed to create message" },
      { status: 500 }
    );
  }
}
