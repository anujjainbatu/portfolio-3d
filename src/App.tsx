import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import "./App.css";
import { ChatProvider } from "./chat/ChatContext";
import ChatWidget from "./chat/ChatWidget";

const CharacterModel = lazy(() => import("./components/Character"));
const MainContainer = lazy(() => import("./components/MainContainer"));
const MyWorks = lazy(() => import("./pages/MyWorks"));
import { LoadingProvider } from "./context/LoadingProvider";

const App = () => {
  return (
    <BrowserRouter>
      <ChatProvider>
        <Routes>
          <Route
            path="/"
            element={
              <LoadingProvider>
                <Suspense>
                  <MainContainer>
                    <Suspense>
                      <CharacterModel />
                    </Suspense>
                  </MainContainer>
                </Suspense>
              </LoadingProvider>
            }
          />
          <Route
            path="/myworks"
            element={
              <Suspense fallback={<div>Loading...</div>}>
                <MyWorks />
              </Suspense>
            }
          />
          {/* Unknown paths, including retired routes, land on the home page
              rather than an empty router outlet. */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <ChatWidget />
      </ChatProvider>
      {import.meta.env.PROD && <Analytics />}
      {import.meta.env.PROD && <SpeedInsights />}
    </BrowserRouter>
  );
};

export default App;
