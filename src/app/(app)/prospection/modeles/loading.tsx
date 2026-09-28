import { ListSkeleton } from "@/components/layout/page-skeletons"

export default function Loading() {
  return <ListSkeleton title="Modèles de mails" titleAlways stats={0} rows={6} />
}
