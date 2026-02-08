import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tokensApi } from '../services/api';
import type { TokensInput } from '../types';

export const useTokensStatus = () => {
  return useQuery({
    queryKey: ['tokens', 'status'],
    queryFn: tokensApi.getStatus,
    staleTime: 1000 * 60 * 10,
  });
};

export const useSaveTokens = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tokens: TokensInput) => tokensApi.save(tokens),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tokens'] }),
  });
};

export const useValidateTokens = () => {
  return useMutation({
    mutationFn: (tokens: TokensInput) => tokensApi.validate(tokens),
  });
};

export const useSaveAndSync = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tokens: TokensInput) => tokensApi.saveAndSync(tokens),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tokens'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['sync-logs'] });
    },
  });
};
