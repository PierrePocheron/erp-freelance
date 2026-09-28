import { ListSkeleton } from "@/components/layout/page-skeletons"

export default function Loading() {
  return <ListSkeleton title="Factures récurrentes" stats={3} rows={5} />
}
