import { redirect } from "next/navigation";

// The trading desk UI is a self-contained bundle served from /public/desk.html.
// It calls the /api/upstox/* routes in this same app for live data.
export default function Home() {
  redirect("/desk.html");
}
