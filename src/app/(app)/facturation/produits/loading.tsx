import { ListSkeleton } from "@/components/layout/page-skeletons"

export default function Loading() {
  return <ListSkeleton title="Produits" stats={0} rows={7} />
}
