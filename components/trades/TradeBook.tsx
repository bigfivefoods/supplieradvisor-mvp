'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { GymFlash } from '@/components/fitness/GymMemberPwaUi';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { applyTradeOp, type Book, type TradeOp } from '@/lib/trades/desk';
import { seedHarbourBook, } from '@/lib/trades/harbour-seed';
import { HARBOUR_NOW } from '@/lib/trades/desk';
import { writeJobCache } from '@/lib/trades/offline-queue';

const KEY = 'sa_trade_harbour_preview_v1';

type TradeBookValue = {
  book: Book;
  ready: boolean;
  error: string;
  notice: string;
  live: boolean;
  icsToken: string;
  dispatch: (op: TradeOp) => void;
  reload: () => void;
  rotateIcs: () => void;
};

const Ctx = createContext<TradeBookValue | null>(null);

export function useTradeBook(): TradeBookValue {
  const value = useContext(Ctx);
  if (!value) throw new Error('Trade book is not ready');
  return value;
}

export function TradeBookProvider({
  children,
  live = false,
}: {
  children: ReactNode;
  live?: boolean;
}) {
  const [book, setBook] = useState<Book>(() => seedHarbourBook(HARBOUR_NOW));
  const [ready, setReady] = useState(!live);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [icsToken, setIcsToken] = useState('');

  const reload = useCallback(() => {
    if (!live) return;
    const companyId = getSelectedCompanyId();
    if (!companyId) {
      setError('Choose a company first.');
      setReady(true);
      return;
    }
    void fetch(`/api/trades/tradegraph?companyId=${companyId}`, { credentials: 'include' })
      .then((res) => res.json())
      .then((data: { store?: Book['store']; desk?: Book['desk']; error?: string; ics_token?: string | null }) => {
        if (!data.store || !data.desk) {
          setError(data.error || 'Could not open TradeAdvisor®');
          return;
        }
        setBook({ store: data.store, desk: data.desk });
        setIcsToken(typeof data.ics_token === 'string' ? data.ics_token : '');
        setError('');
      })
      .catch(() => setError('Could not open TradeAdvisor®'))
      .finally(() => setReady(true));
  }, [live]);

  useEffect(() => {
    if (live) {
      reload();
      return;
    }
    const params = new URLSearchParams(window.location.search);
    if (params.get('reset') === '1') {
      const fresh = seedHarbourBook(HARBOUR_NOW);
      localStorage.setItem(KEY, JSON.stringify(fresh));
      setBook(fresh);
    } else {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        try {
          setBook(JSON.parse(raw) as Book);
        } catch {
          /* keep the seeded book */
        }
      } else {
        localStorage.setItem(KEY, JSON.stringify(book));
      }
    }
    setReady(true);
    // The seed is the first paint. localStorage replaces it after mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, reload]);

  useEffect(() => {
    writeJobCache({
      saved_at: new Date().toISOString(),
      jobs: book.store.jobs.map((job) => ({
        id: job.id,
        number: job.number,
        title: job.title,
        address: job.address,
        status: job.status,
      })),
    });
  }, [book]);

  const dispatch = useCallback(
    (op: TradeOp) => {
      if (live) {
        const companyId = getSelectedCompanyId();
        if (!companyId) {
          setError('Choose a company first.');
          return;
        }
        void fetch('/api/trades/tradegraph', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ companyId, action: 'apply', op }),
        })
          .then((res) => res.json())
          .then((data: { store?: Book['store']; desk?: Book['desk']; error?: string; notices?: Array<{ title: string; body: string }> }) => {
            if (!data.store || !data.desk) {
              setError(data.error || 'Save failed');
              return;
            }
            setBook({ store: data.store, desk: data.desk });
            setError('');
            setNotice((data.notices || []).map((row) => `${row.title}. ${row.body}`).join(' '));
          })
          .catch(() => setError('Save failed'));
        return;
      }
      setBook((current) => {
        try {
          const result = applyTradeOp(current, op, new Date().toISOString());
          localStorage.setItem(KEY, JSON.stringify(result.book));
          setError('');
          setNotice(result.notices.map((row) => `${row.title}. ${row.body}`).join(' '));
          return result.book;
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Could not update that record');
          return current;
        }
      });
    },
    [live]
  );

  const rotateIcs = useCallback(() => {
    if (!live) return;
    const companyId = getSelectedCompanyId();
    if (!companyId) {
      setError('Choose a company first.');
      return;
    }
    void fetch('/api/trades/tradegraph', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId, action: 'rotate_ics' }),
    })
      .then((res) => res.json())
      .then((data: { ics_token?: string; error?: string }) => {
        if (!data.ics_token) {
          setError(data.error || 'Could not rotate the calendar link');
          return;
        }
        setIcsToken(data.ics_token);
        setError('');
        setNotice('Calendar link rotated. Subscribe again with the new link.');
      })
      .catch(() => setError('Could not rotate the calendar link'));
  }, [live]);

  const value = useMemo(
    () => ({ book, ready, error, notice, live, icsToken, dispatch, reload, rotateIcs }),
    [book, ready, error, notice, live, icsToken, dispatch, reload, rotateIcs]
  );

  return (
    <Ctx.Provider value={value}>
      <div data-book-ready={ready ? '1' : '0'}>
        <GymFlash error={error} msg={notice} />
        {children}
      </div>
    </Ctx.Provider>
  );
}
