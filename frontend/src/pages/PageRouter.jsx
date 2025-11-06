import HomePage from "./HomePage";
import HowItWorksPage from "./HowItWorksPage";
import RecognizerUI from "../components/RecognizerUI";

export default function PageRouter({ currentPage }) {
  const PAGES = {
    home: <HomePage />,
    "how-it-works": <HowItWorksPage />,
    recognize: <RecognizerUI />
  };

  return <div className="pt-16 h-[calc(100vh-4rem)] overflow-hidden">
  {pages[currentPage]}
</div>;
}

