import { ListSkeleton } from "@/components/layout/page-skeletons"

export default function Loading() {
  return <ListSkeleton title="Connaissances & compétences" titleAlways stats={4} rows={10} />
}
