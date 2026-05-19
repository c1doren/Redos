declare module 'sentiment' {
  export default class Sentiment {
    analyze(text: string): {
      score: number;
      comparative: number;
      calculation: Array<Record<string, number>>;
      tokens: string[];
      words: string[];
      positive: string[];
      negative: string[];
    };
  }
}
