import { ListSkeleton } from "@/components/layout/page-skeletons"

export default function Loading() {
  return <ListSkeleton title="Modèles d'appel" titleAlways stats={0} rows={7} />
}
