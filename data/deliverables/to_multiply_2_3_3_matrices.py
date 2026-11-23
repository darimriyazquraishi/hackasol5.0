def multiply_matrices(m1, m2):
    # Check if the matrices can be multiplied
    if len(m1[0]) != len(m2):
        raise ValueError("Matrices cannot be multiplied")
    
    # Initialize the result matrix
    result = [[0 for _ in range(len(m2[0]))] for _ in range(len(m1))]
    
    # Perform matrix multiplication
    for i in range(len(m1)):
        for j in range(len(m2[0])):
            for k in range(len(m2)):
                result[i][j] += m1[i][k] * m2[k][j]
    
    return result

# Define two 3x3 matrices
m1 = [[1, 2, 3], [4, 5, 6], [7, 8, 9]]
m2 = [[9, 8, 7], [6, 5, 4], [3, 2, 1]]

# Multiply the matrices
result = multiply_matrices(m1, m2)

# Print the result
for row in result:
    print(row)