import { ListSkeleton } from "@/components/layout/page-skeletons"

export default function Loading() {
  return <ListSkeleton title="Réponses & modèles" titleAlways stats={0} rows={8} />
}
