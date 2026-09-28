import { ListSkeleton } from "@/components/layout/page-skeletons"

export default function Loading() {
  return <ListSkeleton title="Prospects" stats={5} rows={10} />
}
