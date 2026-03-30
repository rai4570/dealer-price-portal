import { useMemo, useState } from "react";

export async function getServerSideProps() {
  const GAS_URL =
    "https://script.google.com/macros/s/AKfycbxNMvZmhSUGOGAG00RNOACY4PPi10fJ8fupXUGOWdA1gtfORSM1fnaWnEuCdx0MHQz_DQ/exec";

  try {
    const res = await fetch(GAS_URL);
    const data = await res.json();

    return {
      props: {
        rawData: data ?? { shop: [], product: [], price: [], work: [] },
      },
    };
  } catch (error) {
    return {
      props: {
        rawData: { shop: [], product: [], price: [], work: [] },
        error: "データ取得に失敗しました。",
      },
    };
  }
}

function toObjects(rows) {
  if (!rows || rows.length < 2) return [];
  const headers = rows[0];
  return rows.slice(1).map((row) => {
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = row[i] ?? "";
    });
    return obj;
  });
}

function normalizePublic(value) {
  const v = String(value).trim().toUpperCase();
  return v === "TRUE" || v === "TRUE()" || v === "1" || v === "公開" || v === "〇" || v === "○";
}

function formatDate(value) {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}/${m}/${day}`;
}

function formatNumber(value) {
  const num = Number(value);
  if (Number.isNaN(num)) return value;
  return num.toLocaleString("ja-JP");
}

export default function Home({ rawData, error }) {
  const shops = useMemo(() => toObjects(rawData.shop), [rawData.shop]);
  const products = useMemo(() => toObjects(rawData.product), [rawData.product]);
  const prices = useMemo(() => toObjects(rawData.price), [rawData.price]);
  const works = useMemo(() => toObjects(rawData.work), [rawData.work]);

  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [currentDealer, setCurrentDealer] = useState(null);
  const [loginError, setLoginError] = useState("");
  const [tab, setTab] = useState("products");

  const [searchText, setSearchText] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  const productMap = useMemo(() => {
    const map = new Map();
    products.forEach((p) => map.set(String(p["商品ID"]), p));
    return map;
  }, [products]);

  const dealerPrices = useMemo(() => {
    if (!currentDealer) return [];
    return prices
      .filter(
        (p) =>
          String(p["販売店ID"]).trim() === String(currentDealer["販売店ID"]).trim() &&
          normalizePublic(p["公開"])
      )
      .map((p) => {
        const product = productMap.get(String(p["商品ID"]).trim()) || {};
        return {
          商品ID: p["商品ID"],
          メーカー: product["メーカー"] || "",
          商品名: product["商品名"] || "",
          型番: product["型番"] || "",
          定価: product["定価"] || "",
          カテゴリ: product["カテゴリ"] || "",
          備考: product["備考"] || "",
          販売価格: p["販売価格"] || "",
          更新日: p["更新日"] || "",
        };
      });
  }, [currentDealer, prices, productMap]);

  const filteredDealerPrices = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();
    return dealerPrices.filter((row) => {
      const matchesKeyword =
        !keyword ||
        String(row["メーカー"]).toLowerCase().includes(keyword) ||
        String(row["商品名"]).toLowerCase().includes(keyword) ||
        String(row["型番"]).toLowerCase().includes(keyword);

      const matchesCategory =
        !categoryFilter || String(row["カテゴリ"]).trim() === String(categoryFilter).trim();

      return matchesKeyword && matchesCategory;
    });
  }, [dealerPrices, searchText, categoryFilter]);

  const categories = useMemo(() => {
    return [...new Set(dealerPrices.map((x) => String(x["カテゴリ"] || "").trim()).filter(Boolean))];
  }, [dealerPrices]);

  const handleLogin = (e) => {
    e.preventDefault();
    setLoginError("");

    const hit = shops.find(
      (s) =>
        String(s["ログインID"]).trim() === String(loginId).trim() &&
        String(s["パスワード"]).trim() === String(password).trim()
    );

    if (!hit) {
      setLoginError("ログイン失敗");
      return;
    }

    setCurrentDealer(hit);
  };

  const handleLogout = () => {
    setCurrentDealer(null);
    setLoginId("");
    setPassword("");
    setSearchText("");
    setCategoryFilter("");
  };

  return (
    <div style={{ padding: 24, fontFamily: "sans-serif" }}>
      <h1>販売店専用価格ポータル</h1>

      {!currentDealer ? (
        <form onSubmit={handleLogin}>
          <input placeholder="ID" onChange={(e) => setLoginId(e.target.value)} />
          <input placeholder="PW" type="password" onChange={(e) => setPassword(e.target.value)} />
          <button>ログイン</button>
          <div style={{ color: "red" }}>{loginError}</div>
        </form>
      ) : (
        <>
          <div style={{ marginBottom: 10 }}>
            {currentDealer["販売店名"]}でログイン中
            <button onClick={handleLogout} style={{ marginLeft: 10 }}>
              ログアウト
            </button>
          </div>

          <div style={{ marginBottom: 10 }}>
            <input
              placeholder="検索"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ padding: 8 }}
            />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={{ marginLeft: 10, padding: 8 }}
            >
              <option value="">全カテゴリ</option>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
              <thead>
                <tr>
                  <th>メーカー</th>
                  <th>商品名</th>
                  <th>型番</th>
                  <th>定価</th>
                  <th>販売価格</th>
                  <th>カテゴリ</th>
                  <th>備考</th>
                  <th>更新日</th>
                </tr>
              </thead>
              <tbody>
                {filteredDealerPrices.map((row, i) => (
                  <tr key={i}>
                    <td style={cell(100)}>{row["メーカー"]}</td>
                    <td style={cell(220)}>{row["商品名"]}</td>
                    <td style={cell(140)}>{row["型番"]}</td>
                    <td style={cell(100)}>{formatNumber(row["定価"])}</td>
                    <td style={cell(120, true)}>{formatNumber(row["販売価格"])}</td>
                    <td style={cell(120)}>{row["カテゴリ"]}</td>

                    {/* ★備考：縦スクロール */}
                    <td style={{ border: "1px solid #ddd", padding: 8, width: 320 }}>
                      <div
                        style={{
                          maxHeight: 60,
                          overflowY: "auto",
                          whiteSpace: "normal",
                          wordBreak: "break-word",
                        }}
                      >
                        {row["備考"]}
                      </div>
                    </td>

                    <td style={cell(120)}>{formatDate(row["更新日"])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function cell(width, bold = false) {
  return {
    border: "1px solid #ddd",
    padding: 8,
    width,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    fontWeight: bold ? "bold" : "normal",
  };
}
