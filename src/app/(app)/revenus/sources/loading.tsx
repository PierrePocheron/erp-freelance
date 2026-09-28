import { ListSkeleton } from "@/components/layout/page-skeletons"

export default function Loading() {
  return <ListSkeleton title="Sources de revenus" stats={0} rows={6} />
}
