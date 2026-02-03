import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export type Witnesses<PS> = {
}

export type ImpureCircuits<PS> = {
  mintTestTokensX(context: __compactRuntime.CircuitContext<PS>,
                  xOut_0: bigint,
                  recipient_0: { is_left: boolean,
                                 left: { bytes: Uint8Array },
                                 right: { bytes: Uint8Array }
                               }): __compactRuntime.CircuitResults<PS, []>;
  mintTestTokensY(context: __compactRuntime.CircuitContext<PS>,
                  yOut_0: bigint,
                  recipient_0: { is_left: boolean,
                                 left: { bytes: Uint8Array },
                                 right: { bytes: Uint8Array }
                               }): __compactRuntime.CircuitResults<PS, []>;
  initLiquidity(context: __compactRuntime.CircuitContext<PS>,
                xIn_0: bigint,
                yIn_0: bigint,
                lpOut_0: bigint,
                recipient_0: { is_left: boolean,
                               left: { bytes: Uint8Array },
                               right: { bytes: Uint8Array }
                             }): __compactRuntime.CircuitResults<PS, []>;
  addLiquidity(context: __compactRuntime.CircuitContext<PS>,
               xIn_0: bigint,
               yIn_0: bigint,
               lpOut_0: bigint,
               recipient_0: { is_left: boolean,
                              left: { bytes: Uint8Array },
                              right: { bytes: Uint8Array }
                            }): __compactRuntime.CircuitResults<PS, []>;
  removeLiquidity(context: __compactRuntime.CircuitContext<PS>,
                  lpIn_0: bigint,
                  xOut_0: bigint,
                  yOut_0: bigint,
                  recipient_0: { is_left: boolean,
                                 left: { bytes: Uint8Array },
                                 right: { bytes: Uint8Array }
                               }): __compactRuntime.CircuitResults<PS, []>;
  swapXToY(context: __compactRuntime.CircuitContext<PS>,
           xIn_0: bigint,
           xFee_0: bigint,
           yOut_0: bigint,
           recipient_0: { is_left: boolean,
                          left: { bytes: Uint8Array },
                          right: { bytes: Uint8Array }
                        }): __compactRuntime.CircuitResults<PS, []>;
  swapYToX(context: __compactRuntime.CircuitContext<PS>,
           yIn_0: bigint,
           xFee_0: bigint,
           xOut_0: bigint,
           recipient_0: { is_left: boolean,
                          left: { bytes: Uint8Array },
                          right: { bytes: Uint8Array }
                        }): __compactRuntime.CircuitResults<PS, []>;
}

export type PureCircuits = {
}

export type Circuits<PS> = {
  mintTestTokensX(context: __compactRuntime.CircuitContext<PS>,
                  xOut_0: bigint,
                  recipient_0: { is_left: boolean,
                                 left: { bytes: Uint8Array },
                                 right: { bytes: Uint8Array }
                               }): __compactRuntime.CircuitResults<PS, []>;
  mintTestTokensY(context: __compactRuntime.CircuitContext<PS>,
                  yOut_0: bigint,
                  recipient_0: { is_left: boolean,
                                 left: { bytes: Uint8Array },
                                 right: { bytes: Uint8Array }
                               }): __compactRuntime.CircuitResults<PS, []>;
  initLiquidity(context: __compactRuntime.CircuitContext<PS>,
                xIn_0: bigint,
                yIn_0: bigint,
                lpOut_0: bigint,
                recipient_0: { is_left: boolean,
                               left: { bytes: Uint8Array },
                               right: { bytes: Uint8Array }
                             }): __compactRuntime.CircuitResults<PS, []>;
  addLiquidity(context: __compactRuntime.CircuitContext<PS>,
               xIn_0: bigint,
               yIn_0: bigint,
               lpOut_0: bigint,
               recipient_0: { is_left: boolean,
                              left: { bytes: Uint8Array },
                              right: { bytes: Uint8Array }
                            }): __compactRuntime.CircuitResults<PS, []>;
  removeLiquidity(context: __compactRuntime.CircuitContext<PS>,
                  lpIn_0: bigint,
                  xOut_0: bigint,
                  yOut_0: bigint,
                  recipient_0: { is_left: boolean,
                                 left: { bytes: Uint8Array },
                                 right: { bytes: Uint8Array }
                               }): __compactRuntime.CircuitResults<PS, []>;
  swapXToY(context: __compactRuntime.CircuitContext<PS>,
           xIn_0: bigint,
           xFee_0: bigint,
           yOut_0: bigint,
           recipient_0: { is_left: boolean,
                          left: { bytes: Uint8Array },
                          right: { bytes: Uint8Array }
                        }): __compactRuntime.CircuitResults<PS, []>;
  swapYToX(context: __compactRuntime.CircuitContext<PS>,
           yIn_0: bigint,
           xFee_0: bigint,
           xOut_0: bigint,
           recipient_0: { is_left: boolean,
                          left: { bytes: Uint8Array },
                          right: { bytes: Uint8Array }
                        }): __compactRuntime.CircuitResults<PS, []>;
}

export type Ledger = {
  readonly feeBps: bigint;
  readonly xRewards: bigint;
  readonly xLiquidity: bigint;
  readonly yLiquidity: bigint;
  readonly lpCirculatingSupply: bigint;
}

export type ContractReferenceLocations = any;

export declare const contractReferenceLocations : ContractReferenceLocations;

export declare class Contract<PS = any, W extends Witnesses<PS> = Witnesses<PS>> {
  witnesses: W;
  circuits: Circuits<PS>;
  impureCircuits: ImpureCircuits<PS>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<PS>, f_0: bigint): __compactRuntime.ConstructorResult<PS>;
}

export declare function ledger(state: __compactRuntime.StateValue | __compactRuntime.ChargedState): Ledger;
export declare const pureCircuits: PureCircuits;
