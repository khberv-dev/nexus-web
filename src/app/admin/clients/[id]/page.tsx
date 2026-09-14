import {ClientDetailRoute} from "../ClientDetailRoute"

export default async function AdminClientPage({params}: { params: Promise<{ id: string }> }) {
    const {id} = await params
    return <ClientDetailRoute id={id}/>
}
