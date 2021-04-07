const concat = <A>(as: A[][]): A[] => {
  return ([] as A[]).concat(...as);
};

export { concat };
