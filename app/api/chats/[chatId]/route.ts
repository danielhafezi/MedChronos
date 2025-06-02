import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

// GET /api/chats/[chatId] - Get a specific chat with all messages
export async function GET(request: NextRequest, props: { params: Promise<{ chatId: string }> }) {
  const params = await props.params;
  try {
    const chat = await prisma.chat.findUnique({
      where: { id: params.chatId },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!chat) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }

    return NextResponse.json(chat);
  } catch (error) {
    console.error("Error fetching chat:", error);
    return NextResponse.json(
      { error: "Failed to fetch chat" },
      { status: 500 }
    );
  }
}

// PATCH /api/chats/[chatId] - Update chat (e.g., set as active)
export async function PATCH(request: NextRequest, props: { params: Promise<{ chatId: string }> }) {
  const params = await props.params;
  try {
    const { isActive, title } = await request.json();

    // If setting as active, deactivate all other chats for this patient
    if (isActive) {
      const chat = await prisma.chat.findUnique({
        where: { id: params.chatId },
        select: { patientId: true },
      });

      if (chat) {
        await prisma.chat.updateMany({
          where: { patientId: chat.patientId },
          data: { isActive: false },
        });
      }
    }

    const updatedChat = await prisma.chat.update({
      where: { id: params.chatId },
      data: {
        ...(isActive !== undefined && { isActive }),
        ...(title !== undefined && { title }),
      },
    });

    return NextResponse.json(updatedChat);
  } catch (error) {
    console.error("Error updating chat:", error);
    return NextResponse.json(
      { error: "Failed to update chat" },
      { status: 500 }
    );
  }
}

// DELETE /api/chats/[chatId] - Delete a chat
export async function DELETE(request: NextRequest, props: { params: Promise<{ chatId: string }> }) {
  const params = await props.params;
  try {
    await prisma.chat.delete({
      where: { id: params.chatId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting chat:", error);
    return NextResponse.json(
      { error: "Failed to delete chat" },
      { status: 500 }
    );
  }
}
