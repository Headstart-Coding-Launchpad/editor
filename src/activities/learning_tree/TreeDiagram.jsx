import { featureQuestion } from './learning_tree.js'

// `on` is the set of boxes on the route a test item took (empty when none is picked).
export default function Tree({ node, features, labels, on }) {
  const lit = on.has(node) ? ' act-lt-on' : ''
  if (node.leaf) {
    return (
      <div
        className={`act-lt-box act-lt-leaf act-lt-tone-${node.label % 6}${lit}`}
        data-testid="lt-leaf"
      >
        <strong>{labels[node.label]}</strong>
        <span className="act-lt-count">{node.n}</span>
      </div>
    )
  }
  return (
    <div className="act-lt-node">
      <div className={`act-lt-box act-lt-question${lit}`} data-testid="lt-question">
        {featureQuestion(features[node.feature])}
      </div>
      <div className="act-lt-kids">
        <div className={`act-lt-kid${on.has(node) && on.has(node.yes) ? ' act-lt-on' : ''}`}>
          <span className={`act-lt-branch${on.has(node) && on.has(node.yes) ? ' act-lt-on' : ''}`}>
            yes
          </span>
          <Tree node={node.yes} features={features} labels={labels} on={on} />
        </div>
        <div className={`act-lt-kid${on.has(node) && on.has(node.no) ? ' act-lt-on' : ''}`}>
          <span className={`act-lt-branch${on.has(node) && on.has(node.no) ? ' act-lt-on' : ''}`}>
            no
          </span>
          <Tree node={node.no} features={features} labels={labels} on={on} />
        </div>
      </div>
    </div>
  )
}
