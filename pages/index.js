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

function TruncateCell({ value, width, bold = false, onOpen }) {
  return (
    <td
      onClick={() => onOpen(value)}
      title="クリックで全文表示"
      style={{
        border: "1px solid #ddd",
        padding: 8,
        width,
        maxWidth: width,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        fontWeight: bold ? "bold" : "normal",
        cursor: "pointer",
        background: "#fff",
      }}
    >
      {value}
    </td>
  );
}

const thStyle = {
  border: "1px solid #ddd",
  padding: 10,
  background: "#f5f5f5",
  textAlign: "left",
  whiteSpace: "nowrap",
};

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

  const [popupText, setPopupText] = useState("");
  const [popupTitle, setPopupTitle] = useState("");

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
        String(row["型番"]).toLowerCase().includes(keyword) ||
        String(row["備考"]).toLowerCase().includes(keyword);

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

  const openPopup = (title, value) => {
    setPopupTitle(title);
    setPopupText(String(value ?? ""));
  };

  const closePopup = () => {
    setPopupTitle("");
    setPopupText("");
  };

  return (
    <div style={{ padding: 24, fontFamily: "sans-serif", maxWidth: 1500, margin: "0 auto" }}>
      <h1>販売店専用価格ポータル</h1>

      {error && (
        <div style={{ background: "#ffe5e5", padding: 12, marginBottom: 16, borderRadius: 8 }}>
          {error}
        </div>
      )}

      {!currentDealer ? (
        <form onSubmit={handleLogin}>
          <input
            placeholder="ID"
            value={loginId}
            onChange={(e) => setLoginId(e.target.value)}
            style={{ padding: 8, marginRight: 8 }}
          />
          <input
            placeholder="PW"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ padding: 8, marginRight: 8 }}
          />
          <button>ログイン</button>
          <div style={{ color: "red", marginTop: 8 }}>{loginError}</div>
        </form>
      ) : (
        <>
          <div style={{ marginBottom: 10 }}>
            {currentDealer["販売店名"]}でログイン中
            <button onClick={handleLogout} style={{ marginLeft: 10 }}>
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

          <div style={{ marginBottom: 16, display: "flex", gap: 12, flexWrap: "wrap" }}>
            <input
              placeholder={tab === "products" ? "メーカー・商品名・型番・備考で検索" : "区分・工事項目で検索"}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ padding: 10, minWidth: 300 }}
            />

            {tab === "products" && (
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                style={{ padding: 10, minWidth: 180 }}
              >
                <option value="">すべてのカテゴリ</option>
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            )}
          </div>

          {tab === "products" ? (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
                <thead>
                  <tr>
                    <th style={thStyle}>メーカー</th>
                    <th style={thStyle}>商品名</th>
                    <th style={thStyle}>型番</th>
                    <th style={thStyle}>定価</th>
                    <th style={thStyle}>販売価格</th>
                    <th style={thStyle}>カテゴリ</th>
                    <th style={thStyle}>備考</th>
                    <th style={thStyle}>更新日</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDealerPrices.map((row, i) => (
                    <tr key={i}>
                      <TruncateCell value={row["メーカー"]} width={100} onOpen={(v) => openPopup("メーカー", v)} />
                      <TruncateCell value={row["商品名"]} width={190} onOpen={(v) => openPopup("商品名", v)} />
                      <TruncateCell value={row["型番"]} width={150} onOpen={(v) => openPopup("型番", v)} />
                      <TruncateCell
                        value={formatNumber(row["定価"])}
                        width={80}
                        onOpen={(v) => openPopup("定価", v)}
                      />
                      <TruncateCell
                        value={formatNumber(row["販売価格"])}
                        width={90}
                        bold
                        onOpen={(v) => openPopup("販売価格", v)}
                      />
                      <TruncateCell value={row["カテゴリ"]} width={110} onOpen={(v) => openPopup("カテゴリ", v)} />

                      <td
                        onClick={() => openPopup("備考", row["備考"])}
                        title="クリックで全文表示"
                        style={{
                          border: "1px solid #ddd",
                          padding: 8,
                          width: 420,
                          maxWidth: 420,
                          cursor: "pointer",
                          verticalAlign: "top",
                          background: "#fffbe6",
                        }}
                      >
                        <div
                          style={{
                            maxHeight: 72,
                            overflowY: "auto",
                            overflowX: "hidden",
                            whiteSpace: "normal",
                            wordBreak: "break-word",
                            lineHeight: "1.5",
                          }}
                        >
                          {row["備考"]}
                        </div>
                      </td>

                      <TruncateCell
                        value={formatDate(row["更新日"])}
                        width={90}
                        onOpen={(v) => openPopup("更新日", v)}
                      />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
                <thead>
                  <tr>
                    <th style={thStyle}>区分</th>
                    <th style={thStyle}>工事項目</th>
                    <th style={thStyle}>単位</th>
                    <th style={thStyle}>単価</th>
                    <th style={thStyle}>更新日</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDealerWorks.map((row, i) => (
                    <tr key={i}>
                      <TruncateCell value={row["区分"]} width={130} onOpen={(v) => openPopup("区分", v)} />
                      <TruncateCell value={row["工事項目"]} width={260} onOpen={(v) => openPopup("工事項目", v)} />
                      <TruncateCell value={row["単位"]} width={90} onOpen={(v) => openPopup("単位", v)} />
                      <TruncateCell
                        value={formatNumber(row["単価"])}
                        width={110}
                        bold
                        onOpen={(v) => openPopup("単価", v)}
                      />
                      <TruncateCell
                        value={formatDate(row["更新日"])}
                        width={90}
                        onOpen={(v) => openPopup("更新日", v)}
                      />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {popupText !== "" && (
            <div
              onClick={closePopup}
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.45)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 9999,
                padding: 20,
              }}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: "min(700px, 100%)",
                  maxHeight: "80vh",
                  background: "#fff",
                  borderRadius: 12,
                  boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
                  padding: 20,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 12,
                  }}
                >
                  <h3 style={{ margin: 0 }}>{popupTitle}</h3>
                  <button onClick={closePopup} style={{ padding: "6px 10px" }}>
                    閉じる
                  </button>
                </div>

                <div
                  style={{
                    border: "1px solid #ddd",
                    borderRadius: 8,
                    padding: 14,
                    maxHeight: "60vh",
                    overflowY: "auto",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    lineHeight: "1.6",
                    background: "#fafafa",
                  }}
                >
                  {popupText}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
