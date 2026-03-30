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

  const dealerWorks = useMemo(() => {
    if (!currentDealer) return [];
    return works.filter(
      (w) =>
        String(w["販売店ID"]).trim() === String(currentDealer["販売店ID"]).trim() &&
        normalizePublic(w["公開"])
    );
  }, [currentDealer, works]);

  const filteredDealerWorks = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();
    return dealerWorks.filter((row) => {
      if (!keyword) return true;
      return (
        String(row["区分"]).toLowerCase().includes(keyword) ||
        String(row["工事項目"]).toLowerCase().includes(keyword)
      );
    });
  }, [dealerWorks, searchText]);

  const handleLogin = (e) => {
    e.preventDefault();
    setLoginError("");

    const hit = shops.find(
      (s) =>
        String(s["ログインID"]).trim() === String(loginId).trim() &&
        String(s["パスワード"]).trim() === String(password).trim() &&
        String(s["状態"]).trim() !== "停止"
    );

    if (!hit) {
      setCurrentDealer(null);
      setLoginError("ログインIDまたはパスワードが違います。");
      return;
    }

    setCurrentDealer(hit);
  };

  const handleLogout = () => {
    setCurrentDealer(null);
    setLoginId("");
    setPassword("");
    setLoginError("");
    setTab("products");
    setSearchText("");
    setCategoryFilter("");
  };

  return (
    <div style={{ padding: 24, fontFamily: "sans-serif", maxWidth: 1400, margin: "0 auto" }}>
      <h1 style={{ marginBottom: 8 }}>販売店専用価格ポータル</h1>
      <p style={{ color: "#555", marginBottom: 24 }}>A版：Googleスプレッドシート連動</p>

      {error && (
        <div style={{ background: "#ffe5e5", padding: 12, marginBottom: 16, borderRadius: 8 }}>
          {error}
        </div>
      )}

      {!currentDealer ? (
        <div style={{ maxWidth: 420, border: "1px solid #ddd", borderRadius: 12, padding: 20 }}>
          <h2 style={{ marginTop: 0 }}>ログイン</h2>
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 12 }}>
              <div style={{ marginBottom: 6 }}>ログインID</div>
              <input
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                style={{ width: "100%", padding: 10, boxSizing: "border-box" }}
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ marginBottom: 6 }}>パスワード</div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ width: "100%", padding: 10, boxSizing: "border-box" }}
              />
            </div>
            {loginError && <div style={{ color: "red", marginBottom: 12 }}>{loginError}</div>}
            <button type="submit" style={{ padding: "10px 16px" }}>
              ログイン
            </button>
          </form>
        </div>
      ) : (
        <>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 16,
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div>
              <strong>{currentDealer["販売店名"]}</strong> でログイン中
            </div>
            <button onClick={handleLogout} style={{ padding: "10px 16px" }}>
              ログアウト
            </button>
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            <button
              onClick={() => setTab("products")}
              style={{
                padding: "10px 16px",
                background: tab === "products" ? "#111" : "#eee",
                color: tab === "products" ? "#fff" : "#000",
                border: "none",
                borderRadius: 8,
              }}
            >
              商品価格
            </button>
            <button
              onClick={() => setTab("works")}
              style={{
                padding: "10px 16px",
                background: tab === "works" ? "#111" : "#eee",
                color: tab === "works" ? "#fff" : "#000",
                border: "none",
                borderRadius: 8,
              }}
            >
              工事費単価
            </button>
          </div>

          <div style={{ display: "block" }}>
            <div
              style={{
                display: "flex",
                gap: 12,
                marginBottom: 16,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <input
                placeholder={tab === "products" ? "メーカー・商品名・型番で検索" : "区分・工事項目で検索"}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                style={{ padding: 10, minWidth: 280 }}
              />

              {tab === "products" && (
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  style={{ padding: 10, minWidth: 180 }}
                >
                  <option value="">すべてのカテゴリ</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {tab === "products" ? (
              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    tableLayout: "fixed",
                  }}
                >
                  <thead>
                    <tr>
                      {["メーカー", "商品名", "型番", "定価", "販売価格", "カテゴリ", "備考", "更新日"].map((h) => (
                        <th
                          key={h}
                          style={{
                            border: "1px solid #ddd",
                            padding: 10,
                            background: "#f5f5f5",
                            textAlign: "left",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDealerPrices.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ border: "1px solid #ddd", padding: 12 }}>
                          表示できる商品がありません。
                        </td>
                      </tr>
                    ) : (
                      filteredDealerPrices.map((row, idx) => (
                        <tr key={idx}>
                          <td
                            style={{
                              border: "1px solid #ddd",
                              padding: 10,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              width: "90px",
                            }}
                          >
                            {row["メーカー"]}
                          </td>
                          <td
                            style={{
                              border: "1px solid #ddd",
                              padding: 10,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              width: "170px",
                            }}
                          >
                            {row["商品名"]}
                          </td>
                          <td
                            style={{
                              border: "1px solid #ddd",
                              padding: 10,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              width: "110px",
                            }}
                          >
                            {row["型番"]}
                          </td>
                          <td
                            style={{
                              border: "1px solid #ddd",
                              padding: 10,
                              whiteSpace: "nowrap",
                              width: "90px",
                            }}
                          >
                            {formatNumber(row["定価"])}
                          </td>
                          <td
                            style={{
                              border: "1px solid #ddd",
                              padding: 10,
                              fontWeight: "bold",
                              whiteSpace: "nowrap",
                              width: "100px",
                            }}
                          >
                            {formatNumber(row["販売価格"])}
                          </td>
                          <td
                            style={{
                              border: "1px solid #ddd",
                              padding: 10,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              width: "110px",
                            }}
                          >
                            {row["カテゴリ"]}
                          </td>
                          <td
                            style={{
                              border: "1px solid #ddd",
                              padding: 10,
                              width: "280px",
                            }}
                          >
                            <div
                              style={{
                                maxWidth: "100%",
                                overflowX: "auto",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {row["備考"]}
                            </div>
                          </td>
                          <td
                            style={{
                              border: "1px solid #ddd",
                              padding: 10,
                              whiteSpace: "nowrap",
                              width: "110px",
                            }}
                          >
                            {formatDate(row["更新日"])}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    tableLayout: "fixed",
                  }}
                >
                  <thead>
                    <tr>
                      {["区分", "工事項目", "単位", "単価", "更新日"].map((h) => (
                        <th
                          key={h}
                          style={{
                            border: "1px solid #ddd",
                            padding: 10,
                            background: "#f5f5f5",
                            textAlign: "left",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDealerWorks.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ border: "1px solid #ddd", padding: 12 }}>
                          表示できる工事費がありません。
                        </td>
                      </tr>
                    ) : (
                      filteredDealerWorks.map((row, idx) => (
                        <tr key={idx}>
                          <td
                            style={{
                              border: "1px solid #ddd",
                              padding: 10,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              width: "120px",
                            }}
                          >
                            {row["区分"]}
                          </td>
                          <td
                            style={{
                              border: "1px solid #ddd",
                              padding: 10,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {row["工事項目"]}
                          </td>
                          <td
                            style={{
                              border: "1px solid #ddd",
                              padding: 10,
                              whiteSpace: "nowrap",
                              width: "90px",
                            }}
                          >
                            {row["単位"]}
                          </td>
                          <td
                            style={{
                              border: "1px solid #ddd",
                              padding: 10,
                              fontWeight: "bold",
                              whiteSpace: "nowrap",
                              width: "120px",
                            }}
                          >
                            {formatNumber(row["単価"])}
                          </td>
                          <td
                            style={{
                              border: "1px solid #ddd",
                              padding: 10,
                              whiteSpace: "nowrap",
                              width: "110px",
                            }}
                          >
                            {formatDate(row["更新日"])}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
