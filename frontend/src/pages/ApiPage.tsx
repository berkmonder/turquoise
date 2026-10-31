// The public API: what it does, with copy-paste examples. The full reference is FastAPI's (/api/docs).

const BASE = "https://turquoise.berkmonder.com";

const chatExample = `curl -s ${BASE}/api/v1/chat \\
  -H 'content-type: application/json' \\
  -d '{"message": "What has Berk built with LLMs?"}'`;

const chatReply = `{
  "answer": "Berk built ...",
  "served_by": "gpu",       // or "fallback": CV search, when the GPU is off
  "reason": null            // why the fallback answered
}`;

const anomalyExample = `python3 - <<'EOF'
import json, math, urllib.request
values = [math.sin(i / 5) for i in range(300)]
values[200] = 4.0                       # an obvious anomaly
req = urllib.request.Request("${BASE}/api/v1/anomaly/detect",
    data=json.dumps({"values": values}).encode(),
    headers={"content-type": "application/json"})
print(json.load(urllib.request.urlopen(req)))
EOF`;

const anomalyReply = `{
  "anomalies": [{"index": 200, "value": 4.0, "expected": 0.75, "z": 41.3}],
  "checked_from": 64,       // the first points only teach the model
  "served_by": "gpu"        // Chronos-Bolt on the GPU, or "fallback" (robust AR)
}`;

export function ApiPage() {
  return (
    <div className="api-page">
      <h1>The API</h1>
      <p className="lead">
        The same systems as the demos, for your own code. JSON in, JSON out. Up to 20 requests a minute per address;
        nothing you send is stored. Every reply says whether Berk's GPU or the fallback served it.
      </p>

      <section>
        <h2>
          <code>POST /api/v1/chat</code> · ask about Berk
        </h2>
        <p>
          Send a <code>message</code>, and optionally the <code>history</code> so far (a list of{" "}
          <code>{"{role, content}"}</code>, up to 12).
        </p>
        <pre><code>{chatExample}</code></pre>
        <pre className="reply"><code>{chatReply}</code></pre>
      </section>

      <section>
        <h2>
          <code>POST /api/v1/anomaly/detect</code> · find anomalies in a series
        </h2>
        <p>
          Send evenly spaced <code>values</code> (80 to 5,000). Each point is compared with a forecast made from the points
          before it; points more than <code>threshold</code> standard deviations away (3.5 unless you say) come back as
          anomalies.
        </p>
        <pre><code>{anomalyExample}</code></pre>
        <pre className="reply"><code>{anomalyReply}</code></pre>
      </section>

      <p>
        Every field, error and limit: the <a href="/api/docs">interactive reference</a> (OpenAPI).
      </p>
    </div>
  );
}
