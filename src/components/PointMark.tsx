type PointMarkProps = {
  className?: string
}

export function PointMark({ className = '' }: PointMarkProps) {
  const classes = className.trim().length > 0 ? `point-mark ${className}` : 'point-mark'

  return <span aria-hidden="true" className={classes} />
}

type PointCostTextProps = {
  amount: number
  template: string
}

export function PointCostText({ amount, template }: PointCostTextProps) {
  const [before, after] = template.split('{cost}')

  return (
    <span className="point-cost-text">
      {before ?? ''}
      <span className="point-cost-value">
        {amount}
        <PointMark />
      </span>
      {after ?? ''}
    </span>
  )
}
