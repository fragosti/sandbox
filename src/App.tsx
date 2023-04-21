import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { SolSandbox } from './sandboxes/sol-sandbox';
import { EthSandbox } from './sandboxes/eth-sandbox';
import { MultiChainSandbox } from './sandboxes/multi-chain-sandbox';

function App() {
  return (
    <Router>
      <Routes>
        <Route index element={<SolSandbox />} />
        <Route path="/sol-sandbox" element={<SolSandbox />} />
        <Route path="/eth-sandbox" element={<EthSandbox />} />
        <Route path="/multi-chain-sandbox" element={<MultiChainSandbox />} />
      </Routes>
    </Router>
  );
}

export default App;