/**
 * @DEV: If the sandbox is throwing dependency errors, chances are you need to clear your browser history.
 * This will trigger a re-install of the dependencies in the sandbox – which should fix things right up.
 * Alternatively, you can fork this sandbox to refresh the dependencies manually.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import styled from 'styled-components';
import { Connection, PublicKey } from '@solana/web3.js';

import {
  createAddressLookupTable,
  createTransferTransaction,
  createTransferTransactionV0,
  extendAddressLookupTable,
  getProvider,
  pollSignatureStatus,
  signAllTransactions,
  signAndSendTransaction,
  signAndSendTransactionV0WithLookupTable,
  signMessage,
  signTransaction,
} from './utils';

import { PhantomProvider, TLog } from './types';

import { Logs, Sidebar } from './components';

// =============================================================================
// Styled Components
// =============================================================================

const StyledApp = styled.div`
  display: flex;
  flex-direction: row;
  height: 100vh;
  @media (max-width: 768px) {
    flex-direction: column;
  }
`;

// =============================================================================
// Constants
// =============================================================================

const message = 'To avoid digital dognappers, sign below to authenticate with CryptoCorgis.';
const sleep = (timeInMS) => new Promise((resolve) => setTimeout(resolve, timeInMS));

const getConnectionUrl = (network: string): string => {
  switch (network) {
    case 'devnet':
      // NB: This URL will only work for Phantom sandbox apps! Please do not use this for your project.
      return `https://rpc-devnet.helius.xyz/?api-key=${process.env.REACT_APP_HELIUS_API}`;
    case 'mainnet':
      // NB: This URL will only work for Phantom sandbox apps! Please do not use this for your project.
      return `https://rpc.helius.xyz/?api-key=${process.env.REACT_APP_HELIUS_API}`;
    default:
      throw new Error(`Invalid network: ${network}`);
  }
};

// =============================================================================
// Typedefs
// =============================================================================
export type ConnectedMethods =
  | {
      name: string;
      onClick: () => Promise<string>;
    }
  | {
      name: string;
      onClick: () => Promise<void>;
    };

interface Props {
  publicKey: PublicKey | null;
  connectedMethods: ConnectedMethods[];
  handleConnect: () => Promise<void>;
  logs: TLog[];
  clearLogs: () => void;
  handleNetworkSwitch: (newNetwork: string) => Promise<void>;
  network: string;
}

// =============================================================================
// Hooks
// =============================================================================

/**
 * @DEVELOPERS
 * The fun stuff!
 */
const useProps = (): Props => {
  const [provider, setProvider] = useState<PhantomProvider | null>(null);
  const [network, setNetwork] = useState('devnet');
  const [connection, setConnection] = useState(new Connection(getConnectionUrl(network)));
  const [logs, setLogs] = useState<TLog[]>([]);

  const createLog = useCallback(
    (log: TLog) => {
      return setLogs((logs) => [...logs, log]);
    },
    [setLogs]
  );

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, [setLogs]);

  useEffect(() => {
    (async () => {
      // sleep for 100 ms to give time to inject
      await sleep(100);
      setProvider(getProvider());
    })();
  }, []);

  useEffect(() => {
    if (!provider) return;

    // attempt to eagerly connect
    provider.connect({ onlyIfTrusted: true }).catch(() => {
      // fail silently
    });

    provider.on('connect', (publicKey: PublicKey) => {
      createLog({
        status: 'success',
        method: 'connect',
        message: `Connected to account ${publicKey.toBase58()}`,
      });
    });

    provider.on('disconnect', () => {
      createLog({
        status: 'warning',
        method: 'disconnect',
        message: '👋',
      });
    });

    provider.on('accountChanged', (publicKey: PublicKey | null) => {
      if (publicKey) {
        createLog({
          status: 'info',
          method: 'accountChanged',
          message: `Switched to account ${publicKey.toBase58()}`,
        });
      } else {
        /**
         * In this case dApps could...
         *
         * 1. Not do anything
         * 2. Only re-connect to the new account if it is trusted
         *
         * ```
         * provider.connect({ onlyIfTrusted: true }).catch((err) => {
         *  // fail silently
         * });
         * ```
         *
         * 3. Always attempt to reconnect
         */

        createLog({
          status: 'info',
          method: 'accountChanged',
          message: 'Attempting to switch accounts.',
        });

        provider.connect().catch((error) => {
          createLog({
            status: 'error',
            method: 'accountChanged',
            message: `Failed to re-connect: ${error.message}`,
          });
        });
      }
    });

    return () => {
      provider.disconnect();
    };
  }, [createLog, provider]);

  /** SignAndSendTransaction */
  const handleSignAndSendTransaction = useCallback(async () => {
    if (!provider) return;

    try {
      const transaction = await createTransferTransaction(provider.publicKey, connection);
      createLog({
        status: 'info',
        method: 'signAndSendTransaction',
        message: `Requesting signature for: ${JSON.stringify(transaction)}`,
      });
      const signature = await signAndSendTransaction(provider, transaction);
      createLog({
        status: 'info',
        method: 'signAndSendTransaction',
        message: `Signed and submitted transaction ${signature}.`,
      });
      pollSignatureStatus(signature, connection, createLog);
    } catch (error) {
      createLog({
        status: 'error',
        method: 'signAndSendTransaction',
        message: error.message,
      });
    }
  }, [createLog, provider, connection]);

  /** SignAndSendTransactionV0 */
  const handleSignAndSendTransactionV0 = useCallback(async () => {
    if (!provider) return;

    try {
      const transactionV0 = await createTransferTransactionV0(provider.publicKey, connection);
      createLog({
        status: 'info',
        method: 'signAndSendTransactionV0',
        message: `Requesting signature for: ${JSON.stringify(transactionV0)}`,
      });
      const signature = await signAndSendTransaction(provider, transactionV0);
      createLog({
        status: 'info',
        method: 'signAndSendTransactionV0',
        message: `Signed and submitted transactionV0 ${signature}.`,
      });
      pollSignatureStatus(signature, connection, createLog);
    } catch (error) {
      createLog({
        status: 'error',
        method: 'signAndSendTransactionV0',
        message: error.message,
      });
    }
  }, [createLog, provider, connection]);

  /** SignAndSendTransactionV0WithLookupTable */
  const handleSignAndSendTransactionV0WithLookupTable = useCallback(async () => {
    if (!provider) return;
    try {
      const [lookupSignature, lookupTableAddress] = await createAddressLookupTable(
        provider,
        provider.publicKey,
        connection,
        await connection.getLatestBlockhash().then((res) => res.blockhash)
      );
      createLog({
        status: 'info',
        method: 'signAndSendTransactionV0WithLookupTable',
        message: `Signed and submitted transactionV0 to make an Address Lookup Table ${lookupTableAddress} with signature: ${lookupSignature}. Please wait for 5-7 seconds after signing the next transaction to be able to see the next transaction popup. This time is needed as newly appended addresses require one slot to warmup before being available to transactions for lookups.`,
      });
      pollSignatureStatus(lookupSignature, connection, createLog);
      const extensionSignature = await extendAddressLookupTable(
        provider,
        provider.publicKey,
        connection,
        await connection.getLatestBlockhash().then((res) => res.blockhash),
        lookupTableAddress
      );
      createLog({
        status: 'info',
        method: 'signAndSendTransactionV0WithLookupTable',
        message: `Signed and submitted transactionV0 to extend Address Lookup Table ${extensionSignature}.`,
      });
      pollSignatureStatus(extensionSignature, connection, createLog);
      const signature = await signAndSendTransactionV0WithLookupTable(
        provider,
        provider.publicKey,
        connection,
        await connection.getLatestBlockhash().then((res) => res.blockhash),
        lookupTableAddress
      );
      createLog({
        status: 'info',
        method: 'signAndSendTransactionV0WithLookupTable',
        message: `Signed and submitted transactionV0 with Address Lookup Table ${signature}.`,
      });
      pollSignatureStatus(signature, connection, createLog);
    } catch (error) {
      createLog({
        status: 'error',
        method: 'signAndSendTransactionV0WithLookupTable',
        message: error.message,
      });
    }
  }, [createLog, provider, connection]);

  /** SignTransaction */
  const handleSignTransaction = useCallback(async () => {
    if (!provider) return;

    try {
      const transaction = await createTransferTransaction(provider.publicKey, connection);
      createLog({
        status: 'info',
        method: 'signTransaction',
        message: `Requesting signature for: ${JSON.stringify(transaction)}`,
      });
      const signedTransaction = await signTransaction(provider, transaction);
      createLog({
        status: 'success',
        method: 'signTransaction',
        message: `Transaction signed: ${JSON.stringify(signedTransaction)}`,
      });
    } catch (error) {
      createLog({
        status: 'error',
        method: 'signTransaction',
        message: error.message,
      });
    }
  }, [createLog, provider, connection]);

  /** SignAllTransactions */
  const handleSignAllTransactions = useCallback(async () => {
    if (!provider) return;

    try {
      const transactions = [
        await createTransferTransaction(provider.publicKey, connection),
        await createTransferTransaction(provider.publicKey, connection),
      ];
      createLog({
        status: 'info',
        method: 'signAllTransactions',
        message: `Requesting signature for: ${JSON.stringify(transactions)}`,
      });
      const signedTransactions = await signAllTransactions(provider, transactions[0], transactions[1]);
      createLog({
        status: 'success',
        method: 'signAllTransactions',
        message: `Transactions signed: ${JSON.stringify(signedTransactions)}`,
      });
    } catch (error) {
      createLog({
        status: 'error',
        method: 'signAllTransactions',
        message: error.message,
      });
    }
  }, [createLog, provider, connection]);

  /** SignMessage */
  const handleSignMessage = useCallback(async () => {
    if (!provider) return;

    try {
      const signedMessage = await signMessage(provider, message);
      createLog({
        status: 'success',
        method: 'signMessage',
        message: `Message signed: ${JSON.stringify(signedMessage)}`,
      });
      return signedMessage;
    } catch (error) {
      createLog({
        status: 'error',
        method: 'signMessage',
        message: error.message,
      });
    }
  }, [createLog, provider]);

  /** Connect */
  const handleConnect = useCallback(async () => {
    if (!provider) return;

    try {
      await provider.connect();
    } catch (error) {
      createLog({
        status: 'error',
        method: 'connect',
        message: error.message,
      });
    }
  }, [createLog, provider]);

  /** Disconnect */
  const handleDisconnect = useCallback(async () => {
    if (!provider) return;

    try {
      await provider.disconnect();
    } catch (error) {
      createLog({
        status: 'error',
        method: 'disconnect',
        message: error.message,
      });
    }
  }, [createLog, provider]);

  /** Network Switch */
  const handleNetworkSwitch = useCallback(
    async (newNetwork: string) => {
      try {
        const newConnection = new Connection(getConnectionUrl(newNetwork), 'confirmed');
        setConnection(newConnection);
        setNetwork(newNetwork);
        createLog({
          status: 'success',
          message: `Switched to ${newNetwork} network`,
        });
      } catch (error) {
        console.log('catch error');
        createLog({
          status: 'error',
          message: error.message,
        });
      }
    },
    [createLog, setConnection, setNetwork]
  );

  const connectedMethods = useMemo(() => {
    return [
      {
        name: 'Sign and Send Transaction (Legacy)',
        onClick: handleSignAndSendTransaction,
      },
      {
        name: 'Sign and Send Transaction (v0)',
        onClick: handleSignAndSendTransactionV0,
      },
      {
        name: 'Sign and Send Transaction (v0 + Lookup table)',
        onClick: handleSignAndSendTransactionV0WithLookupTable,
      },
      {
        name: 'Sign Transaction',
        onClick: handleSignTransaction,
      },
      {
        name: 'Sign All Transactions',
        onClick: handleSignAllTransactions,
      },
      {
        name: 'Sign Message',
        onClick: handleSignMessage,
      },
      {
        name: 'Disconnect',
        onClick: handleDisconnect,
      },
    ];
  }, [
    handleSignAndSendTransaction,
    handleSignAndSendTransactionV0,
    handleSignAndSendTransactionV0WithLookupTable,
    handleSignTransaction,
    handleSignAllTransactions,
    handleSignMessage,
    handleDisconnect,
  ]);

  return {
    publicKey: provider?.publicKey || null,
    connectedMethods,
    handleConnect,
    logs,
    clearLogs,
    handleNetworkSwitch,
    network,
  };
};

// =============================================================================
// Stateless Component
// =============================================================================

const StatelessApp = React.memo((props: Props) => {
  const { publicKey, connectedMethods, handleConnect, logs, clearLogs, handleNetworkSwitch, network } = props;

  return (
    <StyledApp>
      <Sidebar
        publicKey={publicKey}
        connectedMethods={connectedMethods}
        connect={handleConnect}
        handleNetworkSwitch={handleNetworkSwitch}
        network={network}
      />
      <Logs publicKey={publicKey} logs={logs} clearLogs={clearLogs} />
    </StyledApp>
  );
});

// =============================================================================
// Main Component
// =============================================================================

const App = () => {
  const props = useProps();

  return <StatelessApp {...props} />;
};

export default App;
