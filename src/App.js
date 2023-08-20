import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "react-hot-toast";

import PageNotFound from "Pages/PageNotFound/PageNotFound";
import HomePage from "Pages/HomePage/HomePage";

import "styles/global.scss";

function App() {
  return (
    <div className="app">
      <BrowserRouter>
        <Toaster
          position="bottom"
          toastOptions={{
            duration: 3000,
          }}
        />

        <Routes>
          <Route path="/" element={<HomePage />} />

          <Route path="/*" element={<PageNotFound />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
