import Game from "@/components/Game";

export default async function PlayPage({ params }: { params: Promise<{ scenarioId: string }> }) {
  const { scenarioId } = await params;
  return <Game scenarioId={scenarioId} />;
}
