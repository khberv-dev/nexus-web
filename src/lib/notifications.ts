import {prisma} from "@/lib/db/prisma"
import {notificationChannel, redis} from "@/lib/redis"

export async function notify(userId: string, type: string, title: string, message?: string, link?: string) {
    const notification = await prisma.notification.create({data: {userId, type, title, message, link}})

    // Push to Redis so SSE streams pick it up immediately.
    await redis.publish(notificationChannel(userId), JSON.stringify({
        id: notification.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        link: notification.link,
        readAt: null,
        createdAt: notification.createdAt.toISOString(),
    }))

    return notification
}
