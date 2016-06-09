function c=isoC(la,mu)
%
% Copyright 2016 Reza Malehmir
%   Licensed under the Apache License, Version 2.0 (the "License");
%   you may not use this file except in compliance with the License.
%   You may obtain a copy of the License at
%       http://www.apache.org/licenses/LICENSE-2.0
%   Unless required by applicable law or agreed to in writing, software
%   distributed under the License is distributed on an "AS IS" BASIS,
%   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
%   See the License for the specific language governing permissions and
%   limitations under the License.

la2mu=la+2*mu;

c=[la2mu la la 0 0 0
    la  la2mu la  0 0 0
    la la la2mu 0 0 0
            0 0 0 mu 0 0
            0 0 0 0 mu 0
            0 0 0 0 0 mu];
