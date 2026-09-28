import { ListSkeleton } from "@/components/layout/page-skeletons"

export default function Loading() {
  return <ListSkeleton title="Compétences" stats={4} rows={10} />
}
