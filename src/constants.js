// Categories depend on transaction type: money coming in and money going out
// are not the same taxonomy. The Add and Edit forms keep the category field
// disabled until a type is chosen, then offer only the matching set.
export const CATEGORIES_BY_TYPE = {
  income: ['Allowance', 'Salary', 'Freelance', 'Business', 'Gift', 'Refund', 'Other'],
  expense: [
    'Food',
    'Groceries',
    'Transport',
    'Rent',
    'Utilities',
    'Load & Internet',
    'Education',
    'Health',
    'Entertainment',
    'Shopping',
    'Subscriptions',
    'Other',
  ],
}

// Every category that exists, for the Dashboard filter — filtering existing
// data is a different job from creating it, so there we list everything.
export const ALL_CATEGORIES = [
  ...new Set([...CATEGORIES_BY_TYPE.income, ...CATEGORIES_BY_TYPE.expense]),
]

export const TYPES = [
  { value: 'expense', label: 'Expense' },
  { value: 'income', label: 'Income' },
]

/** Options for the category Select, given the chosen type. Empty until one is picked. */
export function categoryOptionsFor(type) {
  return type ? CATEGORIES_BY_TYPE[type].map(name => ({ value: name, label: name })) : []
}

export const OPERATORS = [
  { value: '+', symbol: '+', label: 'Add' },
  { value: '-', symbol: '−', label: 'Subtract' },
  { value: '*', symbol: '×', label: 'Multiply' },
  { value: '/', symbol: '÷', label: 'Divide' },
]

export const CURRENCIES = [
  { code: 'PHP', symbol: '₱', locale: 'en-PH', label: '₱ Philippine peso' },
  { code: 'USD', symbol: '$', locale: 'en-US', label: '$ US dollar' },
  { code: 'EUR', symbol: '€', locale: 'de-DE', label: '€ Euro' },
  { code: 'JPY', symbol: '¥', locale: 'ja-JP', label: '¥ Japanese yen' },
  { code: 'GBP', symbol: '£', locale: 'en-GB', label: '£ Pound sterling' },
]
