function C = CC(C)
if abs(C(4,4) - C(5,5)) < 1.e-5
   C(4,4) = C(4,4)*(1 - 1.e-5);
   C(5,5) = C(5,5)*(1 + 1.e-5);
end
% condition for the positive energy
% for i=1:6
%    if det(C(1:i,1:i)) < 0
%       stop
%    end;
% end;
