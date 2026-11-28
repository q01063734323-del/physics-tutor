import { notFound } from "next/navigation";
import { FeedbackForm } from "./FeedbackForm";

export default function RoyaleFeedbackPage() {
  if (process.env.NEXT_PUBLIC_ROYALE_BETA !== "true") notFound();
  return <FeedbackForm />;
}
